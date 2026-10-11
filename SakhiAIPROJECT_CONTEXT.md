# SakhiAI – Project Context

## Project Name
SakhiAI

## Tagline
Your Trusted Women's Safety & Health Companion

---

# Project Overview

SakhiAI is a women's safety and wellness platform that combines:

- AI Health Assistant
- Period Cycle Tracker
- Wellness Dashboard
- Emergency SOS
- Trusted Circle
- Safety Check-In
- Safe Route Planning
- Health Tips
- Mood Tracking

The application is designed for women to manage their health, wellbeing, and personal safety from a single platform.

---

# Current Tech Stack

## Frontend

- React.js
- Vite
- JavaScript
- CSS
- LocalStorage

## Future Backend

- Node.js
- Express.js
- MongoDB

## Future AI

- OpenAI API
- Anthropic API
- Gemini API

Backend should be provider-independent.

---

# Current Project Structure

src/

components/
- Header.jsx
- BottomNav.jsx
- StatsCards.jsx
- AboutCard.jsx
- HealthTips.jsx

pages/
- HomePage.jsx
- ChatPage.jsx

services/

constants/

SakhiAI.jsx

---

# Theme

## Primary Color

#c2185b

## Secondary Color

#e91e63

## Background

Linear gradients using:

- #fdf6fb
- #fce8f3
- #f0e8ff

## Style

Modern
Clean
Feminine
Professional
Hackathon Ready
Startup Ready

---

# Features Completed

## Home Dashboard

Completed

Contains:

- Welcome Card
- Mood Tracker
- Quick Actions
- Daily Health Tips
- Important Helplines
- Statistics Cards

---

## AI Chat

Completed

Contains:

- Chat Interface
- Suggestions
- Loading Animation
- Voice Placeholder
- Voice Toggle Placeholder

Current Status:

Uses direct API call.

Future:

Move to backend service layer.

---

## Cycle Tracker

Completed

Contains:

- Last Period Date
- Cycle Length
- Next Period Prediction
- Ovulation Prediction
- Fertile Window
- Cycle History

LocalStorage enabled.

---

## Wellness Dashboard

Completed

Contains:

- Water Tracker
- Sleep Tracker
- Mood Tracking
- Wellness Log
- Mood History

LocalStorage enabled.

---

## Trusted Circle

Completed

Contains:

- 3 Emergency Contacts
- SMS Shortcut
- WhatsApp Shortcut
- Call Shortcut

LocalStorage enabled.

---

## Safety Check-In

Completed

Contains:

- Custom Timer
- Countdown
- Safety Confirmation
- Expiry Alert

LocalStorage enabled.

---

## Emergency SOS

Completed

Contains:

- SOS Countdown
- GPS Location
- SMS Alert
- WhatsApp Alert
- Emergency Contacts

---

## Safe Route

Partially Completed

Contains:

- Route Inputs
- Placeholder Screen
- Location Sharing

Future:

Google Maps Integration

---

# Features Pending

## High Priority

### Offline Knowledge Base

Women Health Topics:

- Periods
- PCOS
- Pregnancy
- Nutrition
- Mental Health
- Self Care
- Safety

---

### AI Fallback Responses

If AI API fails:

Return predefined health responses.

---

### AI Service Layer

Create:

services/aiService.js

Responsibilities:

- API calls
- Provider switching
- Error handling
- Fallback responses

---

### Backend Ready Architecture

Move all API calls to:

POST /api/chat

Frontend must never directly call AI providers.

---

## Medium Priority

### Voice Input

Speech To Text

---

### Voice Output

Text To Speech

---

### Notification System

- Wellness Reminders
- Water Reminders
- Period Reminders

---

### Google Maps Integration

Safe Route feature.

---

# LocalStorage Keys

sakhi_mood

sakhi_lmp

sakhi_cycleLength

sakhi_contacts

sakhi_lastSosTs

sakhi_lastSosLoc

sakhi_water

sakhi_sleep

sakhi_moodHistory

sakhi_cycleHistory

sakhi_wellnessLog

sakhi_checkInTime

sakhi_checkInActive

---

# Architecture Rules

1. Reusable Components

Create separate components whenever possible.

2. Service Layer

All APIs must go through services/.

3. Constants

Static data goes to constants/.

4. No hardcoded secrets.

5. Backend Ready.

6. Mobile Responsive.

7. Women-centric UI.

8. Professional coding style.

9. Production-ready folder structure.

10. Keep files under 300 lines whenever possible.

---

# Future Folder Structure

src/

components/
pages/
services/
hooks/
constants/
utils/

---

# Target Users

- Women
- College Students
- Working Professionals
- Travelers
- Women Living Alone

---

# Resume Description

SakhiAI is an AI-powered Women's Safety and Wellness Platform that provides cycle tracking, wellness monitoring, emergency SOS assistance, trusted contact management, safety check-ins, and AI-driven health guidance through a modern responsive web application.

---

# Current Completion

UI/UX: 90%

Features: 80%

Architecture: 60%

Backend: 0%

Overall Project Progress: 80%

---

# Next Development Priorities

1. Offline Knowledge Base
2. AI Fallback Responses
3. aiService.js
4. Voice Features
5. Google Maps Integration
6. Backend Integration
7. MongoDB
8. Deployment