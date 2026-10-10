# Study Buddy Roulette (MERN Stack)

Study Buddy Roulette is a collaborative student study-matching web application built on the MERN stack (MongoDB, Express, React, Node.js). It connects students based on complementary skills, availability, and preferred study modes (online or offline), enabling seamless peer-to-peer tutoring, request management, Google Meet study sessions, chat, notifications, and session reviews.

---

## Features Currently Implemented

- **Authentication & Secure Email Verification:**
  - Email and password registration with bcryptjs password hashing.
  - JWT token generation, persistent session management, and protected routes.
  - Two-step email verification: expiring single-use cryptographic tokens (SHA-256 hashed in database), Nodemailer SMTP integration, and email-link scanner protection (POST-only verification action).
  - Rate-limited resend verification endpoint with generic responses to prevent user enumeration.
- **Student Profiles & Completion Tracking:**
  - Profile customization: academic bio, "Can Help With" skills, "Need Help With" subjects, availability slots, and study mode preferences.
  - Real-time profile completion progress indicator and guidance.
- **Intelligent Buddy Matching:**
  - Automated compatibility scoring matching learners with tutors who possess complementary skills.
  - Subject normalization, alias matching (e.g., DSA, ML, Node.js), and availability alignment.
  - Exclusion of self-matching and offline-only filtering for online searches.
- **Study Request Workflow:**
  - Send direct study requests to matched buddies with customizable subject and notes.
  - Manage incoming and outgoing study requests (Accept / Reject).
- **Study Sessions & Google Meet Integration:**
  - Automatic session creation upon request acceptance.
  - Support for both Online and In-Person study modes.
  - **Google Meet Workflow:**
    1. The tutor creates a Google Meet meeting separately via Google Meet.
    2. The tutor pastes and saves the valid HTTPS Google Meet URL (`https://meet.google.com/xxx-xxxx-xxx`) into the session card.
    3. The meeting URL updates dynamically, allowing both the tutor and learner to join directly.
  - Session status lifecycle: `upcoming` &rarr; `live` &rarr; `completed` (or `cancelled`).
- **Real-Time Polling Chat & Notifications:**
  - In-session messaging between matched study partners with unread message indicators.
  - Notification drawer alerting users to requests, accepted sessions, and message updates.
- **Session Ratings & History:**
  - Rate study sessions (1-5 stars) and leave peer reviews.
  - Historical session logs tracking completed hours, partners, and study topics.

---

## Technology Stack

- **Frontend:**
  - React 19
  - Vite 8
  - React Router v7
  - Lucide React (Icons)
  - Vanilla CSS & CSS Modules (Orange & White Theme)
  - Axios (HTTP client with JWT request interceptors)
- **Backend:**
  - Node.js (ES Modules)
  - Express 4
  - MongoDB Atlas & Mongoose 8
  - JSON Web Tokens (`jsonwebtoken`)
  - Password Hashing (`bcryptjs`)
  - Email Dispatch (`nodemailer`)
  - CORS & Dotenv

---

## Actual Project Structure

```
D:\Users\CHAVAN\FSD2/
├── index.html                           # Canonical Vite HTML entry point
├── vite.config.js                       # Vite build configuration
├── package.json                         # Frontend dependencies and scripts
├── package-lock.json                    # Frontend lockfile
├── .gitignore                           # Root Git ignore rules
├── .env.example                         # Frontend environment template
├── .env                                 # [Private] Local frontend environment variables
├── public/                              # Static public assets
├── src/
│   ├── assets/                          # React SVGs and media
│   ├── components/                      # Modular UI components
│   │   ├── ActiveSessionCard.jsx        # Live session details & Google Meet link interface
│   │   ├── BuddyCard.jsx                # Buddy card with match score percentage
│   │   ├── BuddyDetailsModal.jsx        # Detailed profile & study request dialog
│   │   ├── ChatDrawer.jsx               # In-session chat drawer
│   │   ├── ErrorState.jsx               # Global error alert
│   │   ├── FeedbackModal.jsx            # Star ratings and feedback submission
│   │   ├── LoadingSkeleton.jsx          # UI loading skeletons
│   │   ├── Navbar.jsx                   # Global navigation bar
│   │   ├── NotificationDropdown.jsx     # Notifications list & mark-read
│   │   ├── NotificationToast.jsx        # Notification toasts
│   │   ├── ProtectedRoute.jsx           # JWT & verification route protection
│   │   ├── SessionHistoryCard.jsx       # Completed session card
│   │   └── VerificationScreen.jsx       # Two-step email token verification screen
│   ├── pages/                           # Main view pages
│   │   ├── AuthPage.jsx                 # Login and Registration
│   │   ├── DashboardPage.jsx            # Student dashboard and stats
│   │   ├── FindBuddyPage.jsx            # Buddy matching and search filters
│   │   ├── HistoryPage.jsx              # Study history and past reviews
│   │   ├── ProfilePage.jsx              # Profile, skills, and availability editor
│   │   └── RequestsPage.jsx             # Study request management
│   ├── services/                        # API client services
│   │   ├── apiClient.js                 # Axios instance with auth interceptor
│   │   ├── authService.js               # Auth & email verification API client
│   │   ├── chatService.js               # Chat endpoints API client
│   │   ├── notificationService.js       # Notifications API client
│   │   ├── sessionService.js            # Study session & Meet link API client
│   │   └── userService.js               # Buddy matching & profile API client
│   ├── styles/                          # Component stylesheets
│   ├── utils/                           # Helper utilities (avatars, mock data)
│   ├── App.jsx                          # Main router and auth context
│   ├── App.css                          # Application-level styling
│   ├── index.css                        # Global typography and base styles
│   └── main.jsx                         # Application entry point
├── backend/
│   ├── package.json                     # Backend dependencies and test scripts
│   ├── package-lock.json                # Backend lockfile
│   ├── .gitignore                       # Backend Git ignore rules
│   ├── .env.example                     # Backend environment template
│   ├── .env                             # [Private] Local backend environment variables
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                    # MongoDB Atlas connection handler
│   │   ├── controllers/
│   │   │   ├── authController.js        # Auth, register, login, verify, token refresh
│   │   │   ├── chatController.js        # Message exchange & room history
│   │   │   ├── notificationController.js# User notifications
│   │   │   ├── reviewController.js      # Session ratings & reviews
│   │   │   ├── sessionController.js     # Sessions & Google Meet URL management
│   │   │   └── userController.js        # Profiles & matching algorithm handler
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js        # JWT Bearer token validator
│   │   │   ├── errorHandler.js          # Centralized error handler
│   │   │   └── validationMiddleware.js  # Request validation
│   │   ├── models/
│   │   │   ├── ChatRoom.js              # Chat room schema
│   │   │   ├── Message.js               # Message schema
│   │   │   ├── Notification.js          # Notification schema
│   │   │   ├── Review.js                # Review schema
│   │   │   ├── Session.js               # Study session schema
│   │   │   └── User.js                  # User, profile, and verification token schema
│   │   ├── routes/                      # API route definitions
│   │   │   ├── authRoutes.js            # /api/auth
│   │   │   ├── chatRoutes.js            # /api/chat
│   │   │   ├── notificationRoutes.js    # /api/notifications
│   │   │   ├── reviewRoutes.js          # /api/reviews
│   │   │   ├── sessionRoutes.js         # /api/sessions
│   │   │   └── userRoutes.js            # /api/users
│   │   ├── services/
│   │   │   └── emailService.js          # Nodemailer verification transporter
│   │   ├── utils/
│   │   │   └── matchingAlgorithm.js     # Matching and compatibility scoring
│   │   └── server.js                    # Express app configuration & startup
│   └── tests/                           # Automated backend test suites
│       ├── test_matching_skills_bugfix.js       # Buddy matching regression suite
│       ├── test_meet_link_bugfix.js             # Google Meet link workflow suite
│       ├── test_phase3_suite.js                 # Requests & sessions suite
│       ├── test_phase4_suite.js                 # Chat, reviews, & notifications suite
│       ├── test_phase5_2_e2e_suite.js           # End-to-end user journey suite
│       ├── test_phase5_3_suite.js               # Email verification suite
│       ├── test_phase5_4_security_hardening.js  # Security hardening & rate-limiting suite
│       └── test_smtp_diagnostic.js              # Safe SMTP connection diagnostic
└── README.md
```

---

## Prerequisites & Local Setup

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MongoDB Atlas:** A MongoDB Atlas cluster database URI
- **SMTP Provider (Optional for local testing, required for real emails):** Gmail App Password or Mailtrap account

---

## Environment Configuration

### Frontend (`.env`)
Create `.env` in the project root:
```env
VITE_API_URL=http://localhost:5000/api
```

### Backend (`backend/.env`)
Create `backend/.env` based on `backend/.env.example`:
```env
PORT=5000
NODE_ENV=development

# MongoDB Atlas URI (Use your actual Atlas credentials)
MONGO_URI=mongodb+srv://<db_user>:<db_password>@cluster0.mongodb.net/study_buddy_roulette?retryWrites=true&w=majority

# JWT Secret (Use a secure string of at least 32 characters)
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_here
JWT_EXPIRES_IN=7d

# URLs for CORS and Email Links
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Nodemailer SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_app_password
EMAIL_FROM="Study Buddy Roulette" <noreply@studybuddyroulette.edu>
```

> **Security Notice:** Never commit `.env` files to Git. Both root `.env` and `backend/.env` are ignored in `.gitignore`.

---

## Installation & Running the Application

### 1. Backend Server Setup
From the root directory:
```bash
cd backend
npm install
npm run dev
```
The Express backend starts on `http://localhost:5000`.

### 2. Frontend Client Setup
Open a separate terminal in the root directory:
```bash
npm install
npm run dev
```
The Vite development server runs on `http://localhost:5173`.

---

## Available Test Suites

All tests use safe disposable records and clean up after execution:

```bash
cd backend

# Test buddy matching & skill compatibility
npm run test:matching

# Test Google Meet link permissions & workflow
npm run test:meet

# Test security hardening (GET protection, atomic token consumption, DoS prevention)
npm run test:security

# Test email verification flows
npm run test:verification

# Run full end-to-end integration suite
npm run test:e2e

# Run safe SMTP diagnostic (masks credentials)
npm run test:diagnostic
```

### Frontend Build & Lint Checks
From the project root:
```bash
# Build production bundle
npm run build

# Run Oxlint
npm run lint
```

---

## Deployment Status

> **Notice:** Deployment has **not** yet been performed. The application is configured and verified for local development and pre-deployment testing. Deployment will be addressed in a future phase.