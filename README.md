# 🎓 Study Buddy Roulette

**Study Buddy Roulette** is a peer-to-peer learning platform that connects students who **need help** with students who **can help**.

Instead of randomly searching for someone to study with, the platform finds suitable study buddies based on factors such as **skills, availability, location, and online/offline study preference**.

The project was developed using **React, Vite, and Firebase**.

---
## 🌐 Live Demo

🚀 [Open Study Buddy Roulette](https://study-buddy-roulette.web.app)

## 🌟 Overview

Students often need help with a particular subject or skill but may not know who among their peers can help them.

Study Buddy Roulette solves this problem by allowing students to create profiles containing their skills and availability. A student can search for help, and the application evaluates available users and recommends suitable study buddies using a matching algorithm.

After finding a buddy, users can send study requests, communicate through chat, manage study sessions, join online sessions, provide ratings, and view their previous study activity.

---

## ✨ Features

### 🔐 Authentication

- User registration and login
- Firebase Authentication
- Email verification
- Protected application routes
- Unique Firebase UID for every user

### 👤 Student Profiles

Users can maintain information such as:

- Name
- Skills
- Subjects they can help with
- Subjects they need help with
- Availability
- Location
- Online / Offline study preference

### 🔎 Find Buddy

Students can search for suitable study partners based on their learning requirements.

The system compares users using factors such as:

- Skill compatibility
- Availability
- Location
- Preferred study mode

Suitable users are then displayed along with a **matching percentage**.

### 🎯 Smart Matching Algorithm

Study Buddy Roulette contains a custom matching algorithm that evaluates compatibility between students.

The matching process considers:

```text
Skills
   +
Availability
   +
Location
   +
Online / Offline Preference
   ↓
Compatibility Score
   ↓
Best Study Buddy Matches
```

The matching logic is implemented inside:

```text
src/utils/matchingAlgorithm.js
```

### 📨 Study Requests

Students can:

- Send study requests
- Receive incoming requests
- Accept requests
- Reject requests
- Track request status

Request information is stored and synchronized using **Cloud Firestore**.

### 📚 Study Sessions

After a request is accepted, students can manage a study session.

The session system supports:

- Active sessions
- Session status tracking
- Session completion
- Session cancellation
- Online meeting links
- Learner and helper-specific actions

### 💬 Real-Time Chat

Matched students can communicate through the built-in chat system.

Messages are stored in **Cloud Firestore**, allowing the application to update conversations in real time.

### 🎥 Online Study Sessions

For online sessions, Study Buddy supports meeting links such as **Google Meet**.

```text
Study Request
      ↓
Accepted
      ↓
Online Session
      ↓
Google Meet Link
      ↓
Student joins session
```

### ⭐ Ratings

After completing a study session, learners can rate the student who helped them.

Ratings help maintain feedback about previous study experiences.

### 🔔 Notifications

The application includes notifications for important events such as:

- New study requests
- Accepted requests
- Rejected requests
- Session updates
- Study-related activity

The interface also includes notification badge counts and **Mark All as Read** functionality.

### 📜 Study History

Users can view their previous completed study sessions and related information through the Study History page.

---

# 🏗️ System Architecture

Study Buddy Roulette uses a **serverless Firebase architecture**.

```text
                    ┌──────────────────────┐
                    │        User          │
                    │       Browser        │
                    └──────────┬───────────┘
                               │
                               ▼
              ┌─────────────────────────────┐
              │        React + Vite         │
              │                             │
              │  Authentication             │
              │  Profiles                   │
              │  Find Buddy                 │
              │  Matching Algorithm         │
              │  Requests                   │
              │  Sessions                   │
              │  Chat                       │
              │  Ratings                    │
              │  Notifications              │
              │  Study History              │
              └──────────────┬──────────────┘
                             │
                       Firebase SDK
                             │
               ┌─────────────┴─────────────┐
               │                           │
               ▼                           ▼
      ┌─────────────────┐        ┌──────────────────┐
      │ Firebase Auth   │        │ Cloud Firestore  │
      │                 │        │                  │
      │ Registration    │        │ Users            │
      │ Login           │        │ Requests         │
      │ Email Verify    │        │ Sessions         │
      │ User Identity   │        │ Messages         │
      └─────────────────┘        │ Ratings          │
                                 │ Notifications    │
                                 └────────┬─────────┘
                                          │
                                          ▼
                               ┌────────────────────┐
                               │ Firebase Hosting   │
                               │                    │
                               │ Deployed Web App   │
                               └────────────────────┘
```

Unlike a traditional architecture, Study Buddy does not require a separate Express or Node.js backend server.

The React application communicates directly with Firebase using the **Firebase JavaScript SDK**.

---

# 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend application |
| Vite | Development and build tool |
| JavaScript / JSX | Application logic |
| CSS | User interface styling |
| Firebase Authentication | Login and user authentication |
| Cloud Firestore | Database and real-time data |
| Firebase Hosting | Web application deployment |
| Firebase SDK | Communication between React and Firebase |
| Google Meet | Online study sessions |
| Git | Version control |
| GitHub | Source code hosting |
| npm | Package management |

---

# 📁 Project Structure

```text
StudyBuddy/
│
├── public/
│
├── src/
│   │
│   ├── assets/
│   │
│   ├── components/
│   │   ├── AuthForm.jsx
│   │   ├── AvailabilityInput.jsx
│   │   ├── Dashboard.jsx
│   │   ├── FindBuddyForm.jsx
│   │   ├── HistoryCard.jsx
│   │   ├── MatchBreakdown.jsx
│   │   ├── MatchCard.jsx
│   │   ├── Navbar.jsx
│   │   ├── NotificationPanel.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── RatingModal.jsx
│   │   ├── RequestCard.jsx
│   │   ├── RouletteAnimation.jsx
│   │   ├── SessionCard.jsx
│   │   ├── Sidebar.jsx
│   │   └── SkillInput.jsx
│   │
│   ├── pages/
│   │   ├── AuthPage.jsx
│   │   ├── ChatPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── FindBuddyPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── RequestsPage.jsx
│   │   ├── SessionsPage.jsx
│   │   └── StudyHistoryPage.jsx
│   │
│   ├── services/
│   │   ├── chatService.js
│   │   ├── notificationService.js
│   │   ├── ratingService.js
│   │   ├── requestService.js
│   │   ├── sessionService.js
│   │   └── userService.js
│   │
│   ├── utils/
│   │   ├── dateUtils.js
│   │   ├── matchingAlgorithm.js
│   │   └── timeUtils.js
│   │
│   ├── styles/
│   │
│   ├── App.jsx
│   ├── App.css
│   ├── firebase.js
│   ├── index.css
│   └── main.jsx
│
├── .env.example
├── .firebaserc
├── .gitignore
├── firebase.json
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── vite.config.js
```

---

# 🔄 Application Workflow

```text
User Opens Study Buddy
          ↓
Register / Login
          ↓
Email Verification
          ↓
Complete Profile
          ↓
Add Skills & Availability
          ↓
Choose Need Help / Can Help
          ↓
Find Buddy
          ↓
Matching Algorithm
          ↓
Best Matches Displayed
          ↓
Send Study Request
          ↓
Helper Accepts Request
          ↓
Study Session Created
          ↓
Chat / Online Meeting
          ↓
Session Completed
          ↓
Learner Gives Rating
          ↓
Session Added to Study History
```

---

# 🔥 Firebase Services

## Firebase Authentication

Firebase Authentication is used for:

```text
Registration
Login
Email Verification
User Identification
Protected Access
```

Each user receives a unique Firebase UID that is used to associate the user with their Firestore data.

---

## Cloud Firestore

Cloud Firestore acts as the primary database for the application.

It stores information related to:

```text
Users
Study Requests
Study Sessions
Chats
Ratings
Notifications
Study History
```

Firestore's real-time capabilities are also used for features such as chat and live application updates.

---

## Firebase Hosting

The production React application is deployed using Firebase Hosting.

The deployment process is approximately:

```bash
npm run build
firebase deploy
```

Vite generates the production build inside the:

```text
dist/
```

directory, which Firebase Hosting then serves to users.

---

# 🔐 Security

Firestore access is protected using Firebase Authentication.

Only authenticated users are allowed to access application data.

Example Firestore rule:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /{document=**} {
      allow read, write: if request.auth != null;
    }

  }
}
```

> For a full production deployment, collection-level and user-specific security rules should be implemented for stronger access control.

---

# ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/Chavan-45/Study-Buddy-Roulette.git
```

Move into the project directory:

```bash
cd Study-Buddy-Roulette
```

Install dependencies:

```bash
npm install
```

Create a `.env` file using `.env.example` as reference.

Example:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Run the development server:

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5173
```
https://hackathon-c846d.web.app
---

# 🧪 Production Build

Create a production build using:

```bash
npm run build
```

The generated production files will be placed inside:

```text
dist/
```

---

# 🎨 UI Design

Study Buddy Roulette uses a clean **Orange and White** interface designed around student usability.

The application includes:

```text
Responsive dashboard
Buddy matching cards
Match percentage display
Study request cards
Session management
Notification panel
Rating modal
Chat interface
Study history
Roulette-style matching animation
```

---

# 💡 Why Study Buddy Roulette?

Traditional study groups often depend on students already knowing someone who can help them.

Study Buddy Roulette introduces a structured peer-learning system where students can discover suitable helpers based on actual compatibility.

The platform encourages:

```text
Peer-to-peer learning
Skill sharing
Student collaboration
Accessible academic help
Efficient buddy discovery
Community-based learning
```

---

# 🚀 Future Improvements

Possible future improvements include:

- Advanced recommendation algorithms
- AI-based buddy recommendations
- Better location-based matching
- Automated Google Meet creation
- Push notifications
- Group study sessions
- Tutor reputation system
- Advanced analytics
- Stronger Firestore role-based security
- Mobile application support

---

# 👨‍💻 Developed For

Study Buddy Roulette was originally developed as a **hackathon project** focused on improving peer-to-peer student learning through smart buddy matching.

---

# 📄 License

This project is intended for educational and hackathon purposes.

---

## ⭐ Support

If you find this project useful, consider giving the repository a **star ⭐** on GitHub.