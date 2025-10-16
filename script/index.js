<script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc, collection, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    // Set Firebase Debug logging
    setLogLevel('Debug');

    // --- Global Firebase Variables (MANDATORY USE) ---
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    let app, db, auth;
    let currentUserId = 'Awaiting Auth...';
    let isAuthReady = false;

    // --- Utility Functions ---

    function customAlert(message, type = 'success') {
        const statusBox = document.getElementById('status-message');
        
        // Define colors based on type
        let bgColor = '';
        let textColor = '';
        let borderColor = '';

        if (type === 'success') {
            bgColor = 'bg-green-900/80';
            textColor = 'text-green-300';
            borderColor = 'border-green-500/50';
        } else if (type === 'error') {
            bgColor = 'bg-red-900/80';
            textColor = 'text-red-300';
            borderColor = 'border-red-500/50';
        } else {
            bgColor = 'bg-indigo-900/80';
            textColor = 'text-indigo-300';
            borderColor = 'border-indigo-500/50';
        }

        statusBox.className = `fixed top-20 right-4 z-[10000] p-4 rounded-lg shadow-xl ${bgColor} ${textColor} border ${borderColor} backdrop-blur-md`;
        statusBox.innerHTML = `
            <div class="flex items-start space-x-3">
                <p class="font-medium text-sm">${message}</p>
                <button onclick="document.getElementById('status-message').classList.add('hidden')" class="text-white/70 hover:text-white transition duration-150">
                    &times;
                </button>
            </div>
        `;
        statusBox.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusBox.classList.add('hidden');
        }, 5000);
    };

    window.alert = customAlert; // Override default alert

    function showPage(pageId, requiresAuth = false) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden-page');
        });

        // Show the requested view
        const targetView = document.getElementById(pageId);
        if (targetView) {
            targetView.classList.remove('hidden-page');
            window.scrollTo(0, 0); // Scroll to top of the new page
        }
        
        if (requiresAuth && pageId !== 'landing-page') {
            // Update the User ID display on the portal pages
            const userIdDisplay = document.getElementById(pageId.replace('-', '-') + '-user-id');
            if (userIdDisplay) {
                userIdDisplay.textContent = currentUserId;
            }
        }
    }

    window.showPage = showPage; // Make function globally accessible

    // Function to switch between login and sign-up forms in a portal
    function toggleForm(role, mode) {
        const portal = document.getElementById(role + '-portal');
        const loginForm = portal.querySelector(`#${role}-login-form`);
        const signupForm = portal.querySelector(`#${role}-signup-form`);
        const loginTab = portal.querySelector(`#${role}-login-tab`);
        const signupTab = portal.querySelector(`#${role}-signup-tab`);

        if (mode === 'login') {
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            loginTab.classList.add('bg-accent/20', 'border', 'border-accent');
            signupTab.classList.remove('bg-accent/20', 'border', 'border-accent');
            signupTab.classList.add('bg-white/10');
        } else {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            signupTab.classList.add('bg-accent/20', 'border', 'border-accent');
            loginTab.classList.remove('bg-accent/20', 'border', 'border-accent');
            loginTab.classList.add('bg-white/10');
        }
    }
    window.toggleForm = toggleForm; // Make function globally accessible

    // --- Firebase Auth & Firestore Logic ---

    async function initFirebaseAndAuth() {
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            
            // Sign in using the initial token or anonymously
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }

            currentUserId = auth.currentUser?.uid || crypto.randomUUID();
            isAuthReady = true;

            console.log("Firebase initialized. User ID:", currentUserId);
            
        } catch (error) {
            console.error("Error initializing Firebase or authentication:", error);
            customAlert("Failed to connect to core services. Please try again.", 'error');
        }
    }

    /**
     * Attempts to register a new user with Email/Password and sets their role in Firestore.
     * @param {Event} e The form submission event.
     * @param {string} role 'student' or 'teacher'.
     */
    async function handleSignUp(e, role) {
        e.preventDefault();
        if (!isAuthReady) { customAlert("System initializing, please wait.", 'error'); return; }

        const formId = role === 'student' ? 's' : 't';
        const email = document.getElementById(`${formId}_email_signup`).value;
        const password = document.getElementById(`${formId}_password_signup`).value;
        const fullName = document.getElementById(`${formId}_name_signup`).value;

        customAlert("Processing registration...", 'info');
        
        try {
            // 1. Sign out the current anonymous user (to create a new persistent account)
            await signOut(auth);

            // 2. Create the new user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // 3. Set the user's role and details in Firestore (Private Data path)
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'user_profiles', 'profile');
            
            await setDoc(userDocRef, {
                uid: user.uid,
                email: email,
                fullName: fullName,
                role: role,
                createdAt: new Date().toISOString()
            });

            currentUserId = user.uid; // Update the global UID
            
            customAlert(`Welcome, ${fullName}! Your ${role.toUpperCase()} account has been created. Your User ID is now: ${currentUserId}`, 'success');
            
            // Clear form
            e.target.reset();

            // Display the new user ID
            document.getElementById(role + '-user-id').textContent = currentUserId;

        } catch (error) {
            console.error("Sign Up Error:", error);
            let errorMessage = "Registration failed. Please check your email and password.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please try logging in.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Password is too weak. Must be at least 6 characters.";
            }
            customAlert(errorMessage, 'error');
            // Re-authenticate anonymously if sign up failed
            await signInAnonymously(auth);
        }
    }
    window.handleSignUp = handleSignUp;

    /**
     * Attempts to log in an existing user and validates their role against Firestore.
     * @param {Event} e The form submission event.
     * @param {string} expectedRole 'student' or 'teacher'.
     */
    async function handleLogin(e, expectedRole) {
        e.preventDefault();
        if (!isAuthReady) { customAlert("System initializing, please wait.", 'error'); return; }

        const formId = expectedRole === 'student' ? 's' : 't';
        const email = document.getElementById(`${formId}_email_login`).value;
        const password = document.getElementById(`${formId}_password_login`).value;

        customAlert("Attempting login...", 'info');

        try {
            // 1. Sign out the current anonymous user
            await signOut(auth);

            // 2. Sign in with provided credentials
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 3. Fetch user profile from Firestore to confirm role
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'user_profiles', 'profile');
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // If profile doesn't exist, sign out and throw error
                await signOut(auth);
                throw new Error("User profile missing. Please register first.");
            }

            const userData = userDoc.data();

            if (userData.role !== expectedRole) {
                // Role mismatch
                await signOut(auth);
                customAlert(`Login failed: You are registered as a ${userData.role.toUpperCase()}. Please use the correct portal.`, 'error');
                // Re-authenticate anonymously
                await signInAnonymously(auth);
                return;
            }

            currentUserId = user.uid; // Update the global UID

            customAlert(`Login Successful! Welcome back, ${userData.fullName}. Role: ${userData.role.toUpperCase()}.`, 'success');

            // Clear form
            e.target.reset();
            
            // Display the new user ID
            document.getElementById(expectedRole + '-user-id').textContent = currentUserId;

        } catch (error) {
            console.error("Login Error:", error);
            let errorMessage = "Login failed. Check your email and password.";
            
            if (error.code === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password. Please try again.";
            } else if (error.message.includes("User profile missing")) {
                errorMessage = error.message;
            }

            customAlert(errorMessage, 'error');

            // Re-authenticate anonymously if login failed
            await signInAnonymously(auth);
        }
    }
    window.handleLogin = handleLogin;

    // --- INITIALIZATION ---
    window.onload = function () {
        initFirebaseAndAuth();
        // Default to showing the landing page
        showPage('landing-page');
    };
</script>
