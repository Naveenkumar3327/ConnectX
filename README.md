# 💬 ConnectX

### Secure Real-Time Messaging Platform

ConnectX is a modern, enterprise-grade real-time messaging application built using the MERN Stack. Inspired by WhatsApp, it provides secure communication through individual chats, group conversations, broadcasts, media sharing, voice notes, location sharing, and end-to-end encryption.

---

## 🚀 Features

### 🔐 Authentication & Security

* JWT Authentication
* Secure Password Hashing
* Email Verification
* Forgot Password & OTP Verification
* End-to-End Message Encryption
* Protected Routes
* Role-Based Access Control

### 💬 Real-Time Messaging

* One-to-One Chat
* Real-Time Message Delivery
* Typing Indicators
* Online / Offline Status
* Read Receipts
* Message Reactions
* Reply to Messages
* Edit Messages
* Delete Messages
* Forward Messages
* Search Messages

### 👥 Group Chats

* Create Groups
* Add/Remove Members
* Multiple Admin Support
* Group Profile Picture
* Group Description
* Group Invite Links
* Group Announcements
* Group Media Sharing

### 📢 Broadcast Messaging

* Create Broadcast Lists
* Send Messages to Multiple Users
* Manage Broadcast Lists
* Edit/Delete Broadcasts

### 📂 Media Sharing

* Images
* Videos
* Documents
* PDFs
* Voice Notes
* Audio Files
* Location Sharing
* Contact Sharing

### 📞 Calling Features

* Voice Calls
* Video Calls
* Group Calls
* Screen Sharing
* WebRTC Integration

### 🔔 Notifications

* Real-Time Notifications
* Browser Push Notifications
* Message Alerts
* Group Notifications

### 🎨 User Experience

* Responsive Design
* Mobile Friendly
* Dark Mode
* Light Mode
* Modern UI/UX
* Smooth Animations

---

## 🛠 Tech Stack

### Frontend

* React.js
* React Router DOM
* Redux Toolkit
* Tailwind CSS
* Axios
* Socket.IO Client
* Framer Motion

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* Socket.IO
* JWT
* Bcrypt

### Cloud Services

* MongoDB Atlas
* Cloudinary
* Vercel
* Render

---

## 📁 Project Structure

```bash
ConnectX/
│
├── client/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   └── assets/
│
├── server/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── models/
│   ├── sockets/
│   ├── services/
│   └── utils/
│
├── uploads/
├── docs/
└── README.md
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/connectx.git
cd connectx
```

### Install Dependencies

#### Frontend

```bash
cd client
npm install
```

#### Backend

```bash
cd server
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file inside the server directory.

```env
PORT=5000

MONGO_URI=your_mongodb_connection

JWT_SECRET=your_jwt_secret

CLIENT_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name

CLOUDINARY_API_KEY=your_api_key

CLOUDINARY_API_SECRET=your_api_secret
```

---

## ▶️ Run Application

### Start Backend

```bash
cd server
npm run dev
```

### Start Frontend

```bash
cd client
npm run dev
```

---

## 📊 Future Enhancements

* AI Chat Assistant
* Message Translation
* Scheduled Messages
* Disappearing Messages
* Chat Backup & Restore
* Advanced Analytics
* Multi-Device Sync
* Desktop Application
* Mobile Application

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License.

---



### ⭐ If you like this project, don't forget to star the repository!
