````
# Astro Shantiram

## Website & Spiritual Astrology Platform

**Astro Shantiram** is a modern multilingual spiritual, astrology, puja, consultation, and knowledge platform for **Acharya Shantiram Koirala**.

The platform provides an official digital presence for Guru Shantiram Koirala and allows visitors to:

- Learn about Acharya Shantiram Koirala
- Explore astrology and spiritual services
- View daily, weekly, monthly, and yearly horoscopes
- Schedule astrology consultations
- Book puja and spiritual services
- Schedule in-person, phone, or Zoom consultations
- View Guruji's availability through an interactive calendar
- Watch YouTube videos and pravachans
- Display recent Facebook content
- Read spiritual articles
- Browse and read uploaded books/PDF publications
- View photos, events, and spiritual activities
- Submit contact and puja requests
- Use the website in English, नेपाली, and संस्कृतम्

The design combines traditional Sanatan spiritual aesthetics with a premium, modern, responsive digital experience.


---


# 1. Brand Identity

## Website Name

**ASTRO SHANTIRAM**

## Guru

**Acharya Shantiram Koirala**

## Suggested Tagline

> Astrology • Spirituality • Puja • Wisdom

Alternative:

> Ancient Wisdom. Spiritual Guidance. Modern Connection.

Nepali:

> ज्योतिष • अध्यात्म • पूजा • ज्ञान

Sanskrit:

> ज्योतिषम् • अध्यात्मम् • पूजा • ज्ञानम्


---


# 2. Product Vision

Astro Shantiram should be built as a **digital spiritual ecosystem**, not simply a profile website.

The platform should eventually support:

- Guru profile and biography
- Astrology
- Horoscope
- Kundali-related services
- Puja booking
- Spiritual consultation
- Zoom consultation
- Interactive calendar
- Festival calendar
- Panchang
- Books and publications
- Pravachan
- YouTube
- Facebook
- Articles
- Gallery
- Events
- Notifications
- Payments
- Online courses
- Community features

The architecture should therefore be modular and extensible.


---


# 3. Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- next-intl
- React Hook Form
- Zod
- TanStack Query

## Backend

- Node.js
- Express.js
- TypeScript
- REST API
- JWT authentication
- Zod validation

## Database

- PostgreSQL

Recommended providers:

- Neon
- Supabase
- Heroku Postgres

## Media

- Cloudinary

Cloudinary will manage:

- Images
- Guru photos
- Book covers
- Gallery images
- Article images
- Event images
- Service images
- Documents/PDFs where appropriate
- Optimized thumbnails

## Integrations

- YouTube
- Facebook
- Zoom API
- Email provider
- Future payment provider

## Deployment

- Frontend: Vercel
- Backend: Vercel-compatible Node deployment or separate Node hosting
- Database: Managed PostgreSQL
- Media: Cloudinary


---


# 4. High-Level Architecture

```text
                         VISITORS
                            |
                            v
                 +----------------------+
                 |       VERCEL         |
                 |      Next.js         |
                 |      Frontend        |
                 +----------+-----------+
                            |
                       HTTPS / REST
                            |
                            v
                 +----------------------+
                 |      Node.js         |
                 |     Express API      |
                 +----------+-----------+
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
   +-------------+   +-------------+   +-------------+
   | PostgreSQL  |   | Cloudinary  |   |  Zoom API   |
   |  Database   |   |   Media     |   |  Meetings   |
   +-------------+   +-------------+   +-------------+

          External Content Integrations
          +-----------------------------+
          | YouTube | Facebook | Email |
          +-----------------------------+
```


---


# 5. Main Website Navigation

```text
Home
About Guru
Astrology
Horoscope
Services
Appointments
Calendar
Pravachan
Books
Articles
Events
Gallery
Contact
```

Global actions:

```text
Language
Search
Book Consultation
```


---


# 6. Homepage

The homepage should feel peaceful, spiritual, trustworthy, and premium.

## Hero Section

Display:

- Guruji's portrait
- Spiritual/temple background
- Sanskrit verse
- Short introduction
- Primary call-to-action buttons

Example:

> Acharya Shantiram Koirala

> Astrology • Spirituality • Wisdom

Buttons:

```text
BOOK CONSULTATION
EXPLORE SERVICES
WATCH PRAVACHAN
```

## Homepage Sections

1. Hero
2. About Guruji
3. Astrology Services
4. Horoscope
5. Upcoming Events
6. Latest Pravachan
7. Book Library
8. Puja Services
9. Daily Shloka / Mantra
10. Facebook Updates
11. Testimonials
12. Contact
13. Footer


---


# 7. About Guruji

Dedicated biography page.

Content areas:

- Introduction
- Spiritual journey
- Education
- Astrology background
- Religious service
- Temple/community involvement
- Notable works
- Publications
- Philosophy
- Mission

The biography should support English, Nepali, and Sanskrit content where applicable.


---


# 8. Astrology Platform

Astrology should be one of the primary sections.

## Astrology Services

Examples:

```text
Birth Chart / Kundali
Kundali Analysis
Marriage Compatibility
Career Astrology
Financial Astrology
Graha Dasha Analysis
Navagraha Consultation
Vastu Consultation
Muhurat
Prashna Kundali
Name Analysis
Numerology
```

Each service should have its own page.

## Service Details

Each service should support:

```text
Service Name
Description
Category
Duration
Price
Location
Consultation Type
Availability
Booking Status
Required Information
```


---


# 9. Horoscope System

Dedicated horoscope section.

## Zodiac Signs

```text
Mesha
Vrishabha
Mithuna
Karka
Simha
Kanya
Tula
Vrishchika
Dhanu
Makara
Kumbha
Meena
```

## Horoscope Types

```text
Daily Horoscope
Weekly Horoscope
Monthly Horoscope
Yearly Horoscope
Festival Horoscope
Special Astrology Updates
```

Each horoscope can contain:

- General overview
- Career
- Finance
- Relationships
- Health/well-being
- Spiritual guidance
- Lucky information where appropriate

Horoscopes must support multilingual content.


---


# 10. Astrology Schedule

Guruji needs a configurable availability schedule.

Example:

```text
Monday
5:00 PM – 8:00 PM
Astrology Consultation

Tuesday
6:00 PM – 9:00 PM
Puja Consultation

Wednesday
By Appointment

Thursday
5:00 PM – 8:00 PM
Astrology Consultation
```

Admin should be able to configure:

- Working days
- Start time
- End time
- Break periods
- Appointment duration
- Maximum appointments
- Blocked dates
- Holiday dates


---


# 11. Appointment System

Users can schedule:

```text
Service
Date
Time
Consultation Type
Language
Location
Notes
```

## Consultation Types

```text
In Person
Phone
Zoom
```

## Appointment Lifecycle

```text
Requested
Pending
Confirmed
Rescheduled
Cancelled
Completed
No Show
```


---


# 12. Interactive Calendar

Create a full calendar system.

Calendar views:

```text
Month
Week
Day
Agenda
```

Calendar can display:

- Guru availability
- Appointments
- Puja schedules
- Events
- Festivals
- Pravachan
- Zoom consultations

Use color/status indicators carefully while maintaining the spiritual design.


---


# 13. Zoom API Integration

Zoom should be integrated through the backend.

## Booking Flow

```text
User
  |
  v
Select Service
  |
  v
Select Date/Time
  |
  v
Select Zoom Consultation
  |
  v
Appointment Created
  |
  v
Node.js Backend
  |
  v
Zoom API
  |
  v
Meeting Created
  |
  v
Meeting Details Saved
  |
  v
Email Confirmation
```

## Zoom Data

Store:

```text
zoom_meeting_id
meeting_url
start_time
duration
password
appointment_id
```

Never expose Zoom client secrets to the frontend.


---


# 14. Puja Services

Create a dedicated Puja section.

Examples:

```text
Rudrabhishek
Satyanarayan Puja
Navagraha Puja
Graha Shanti
Lakshmi Puja
Griha Pravesh
Havan
Marriage Rituals
Bratabandha
Shraddha
Other Custom Puja
```

Each service should include:

- Description
- Purpose
- Duration
- Location
- Requirements
- Price, if applicable
- Available dates
- Request/booking button


---


# 15. Puja Request Form

Fields:

```text
Name
Phone
Email
Puja Type
Preferred Date
Preferred Time
Location
Gotra
Family Names
Special Request
Document Upload
```

Admin can review and respond to requests.


---


# 16. Book Library

The platform should include a dedicated digital library.

Guruji/Admin can upload:

- Spiritual books
- Astrology books
- Sanskrit materials
- Nepali publications
- Articles
- PDF documents

## Book Metadata

```text
Title
Cover Image
Author
Description
Language
Category
Publication Date
PDF
Preview
Featured Status
```

## Book Categories

```text
Astrology
Spirituality
Sanatan Dharma
Sanskrit
Nepali Culture
Puja
Philosophy
Other
```


---


# 17. Online Book Reader

Users should be able to:

```text
Read Online
Download
Search
Zoom
Navigate Pages
```

Future:

```text
Chapter Navigation
Bookmarks
Reading Progress
Favorites
```

Book PDFs should be stored securely and delivered through Cloudinary or an appropriate document storage strategy.


---


# 18. Cloudinary Architecture

Use Cloudinary for optimized media.

Suggested folders:

```text
astro-shantiram/
|
+-- guru/
+-- books/
+-- articles/
+-- services/
+-- events/
+-- gallery/
+-- horoscopes/
+-- documents/
+-- thumbnails/
```

Use Cloudinary transformations for:

- Responsive images
- WebP/AVIF delivery
- Thumbnail generation
- Cropping
- Compression
- Image resizing

Cloudinary secrets must remain server-side.


---


# 19. YouTube Integration

Dedicated media section.

Categories:

```text
Latest Videos
Pravachan
Astrology
Puja
Spiritual Teachings
Shorts
Live
```

Store:

```text
YouTube Video ID
Title
Description
Category
Thumbnail
Language
Published Date
```

Videos should be embedded rather than unnecessarily downloaded to the server.


---


# 20. Facebook Integration

Display recent Facebook content where supported by Facebook's current API and permissions.

Possible content:

```text
Recent Posts
Photos
Announcements
Events
Videos
```

The Facebook integration should be isolated as a replaceable module because Meta API permissions and availability can change.

Fallback option:

```text
Official Facebook Page
```

with a prominent link if direct feed access is unavailable.


---


# 21. Pravachan

Dedicated spiritual media center.

Categories:

```text
Bhagavad Gita
Vedas
Upanishads
Puranas
Sanatan Dharma
Spirituality
Nepali Culture
Festival Teachings
Astrology
```

Features:

- YouTube embedding
- Search
- Category filtering
- Language filtering
- Featured videos
- Latest videos


---


# 22. Articles / Blog

Guruji or authorized admins can publish:

- Astrology articles
- Spiritual teachings
- Festival explanations
- Sanskrit meanings
- Nepali cultural articles
- Puja information
- Dharma-related articles
- Astrology guidance

SEO-friendly URLs:

```text
/articles/meaning-of-maha-shivaratri
/articles/understanding-navagraha
```


---


# 23. Events

Event management system.

Each event supports:

```text
Event Name
Date
Start Time
End Time
Location
Description
Image
Registration URL
YouTube URL
Zoom URL
```

Examples:

```text
Mahashivaratri
Janai Purnima
Dashain
Tihar
Ram Navami
Krishna Janmashtami
Special Pravachan
Astrology Workshop
Puja Events
```


---


# 24. Spiritual Calendar

Create an interactive spiritual calendar supporting:

```text
Ekadashi
Purnima
Amavasya
Sankranti
Major Festivals
Special Puja Dates
Guruji Events
```

Future Panchang module:

```text
Tithi
Nakshatra
Yoga
Karana
Sunrise
Sunset
Rashi
Festival Information
```

Astrological calculations should use a reliable calculation library/service rather than manually maintained dates.


---


# 25. Gallery

Gallery categories:

```text
Guruji
Temple
Puja
Events
Community
Spiritual Activities
Travel
```

Features:

- Cloudinary image optimization
- Lazy loading
- Responsive grid
- Lightbox
- Video support
- Category filtering


---


# 26. Contact

Contact form:

```text
Name
Email
Phone
Subject
Message
```

Inquiry categories:

```text
General Inquiry
Puja
Astrology
Consultation
Events
Books
Other
```


---


# 27. Spiritual Interactive Features

Potential interactive components:

## Daily Shloka

```text
Today's Shloka
Sanskrit
Nepali Meaning
English Meaning
```

## Daily Mantra

## Quote of the Day

## Festival Countdown

## Panchang

## Zodiac Selector

## Virtual Diya

Interactive elements should remain subtle and elegant.


---


# 28. Multilingual Architecture

Supported languages:

```text
English
नेपाली
संस्कृतम्
```

Recommended URL structure:

```text
/en
/ne
/sa
```

Examples:

```text
/en/services
/ne/services
/sa/services
```

Use `next-intl` for frontend localization.

CMS content should support translated fields.

Example:

```text
content
content_translations
```


---


# 29. Admin Dashboard

The admin dashboard should provide centralized management.

## Dashboard Metrics

```text
Total Appointments
Today's Appointments
Upcoming Appointments
New Messages
Published Articles
Books
Videos
Events
Services
Pending Puja Requests
```

## Content Management

Admin can manage:

```text
Pages
Articles
Books
Videos
Events
Gallery
Quotes
Mantras
Horoscopes
Services
Testimonials
```


---


# 30. Appointment Management

Admin can:

```text
View appointments
Approve
Reject
Reschedule
Cancel
Mark completed
Create Zoom meeting
Send confirmation
Send reminder
```


---


# 31. Schedule Management

Admin can configure:

```text
Working Days
Available Hours
Break Times
Blocked Dates
Holiday Dates
Maximum Appointments / Day
Appointment Duration
```


---


# 32. Notifications

## Customer Notifications

```text
Booking Received
Booking Confirmed
Booking Cancelled
Booking Rescheduled
Zoom Meeting Created
Appointment Reminder
```

## Admin Notifications

```text
New Booking
New Contact Form
New Puja Request
New Consultation Request
```

Email should be implemented through a replaceable provider.


---


# 33. Global Search

Search across:

```text
Articles
Books
Videos
Services
Horoscopes
Events
```

Example:

```text
Search: Shivaratri
```

Possible results:

```text
Shivaratri Article
Shivaratri Pravachan
Shivaratri Puja
Shivaratri Book
Shivaratri Event
```


---


# 34. User Roles

## Super Admin

Full access.

## Content Admin

```text
Articles
Books
Videos
Events
Gallery
Horoscope
```

## Appointment Manager

```text
Appointments
Schedule
Zoom
Services
```

## Guru

Limited dashboard:

```text
Appointments
Schedule
Articles
Horoscopes
Videos
```


---


# 35. Database Tables

Core tables:

```text
users
roles
guru_profile

services
service_categories

appointments
availability
blocked_dates

zoom_meetings

events
event_registrations

articles
article_translations

books
book_translations

videos
video_categories

horoscopes
horoscope_translations

gallery
gallery_categories

puja_requests

contact_messages

testimonials

quotes
mantras

social_posts

notifications
```

Future tables:

```text
payments
subscriptions
courses
course_lessons
panchang
kundali_requests
favorites
user_notifications
```


---


# 36. API Structure

Suggested REST endpoints:

```text
/api/auth
/api/guru
/api/services
/api/appointments
/api/availability
/api/calendar
/api/zoom
/api/horoscopes
/api/articles
/api/books
/api/videos
/api/events
/api/gallery
/api/puja
/api/contact
/api/testimonials
/api/search
```

Admin endpoints should be protected by role-based authorization.


---


# 37. Security

Backend must implement:

```text
JWT Authentication
bcrypt password hashing
Role-Based Access Control
Rate Limiting
CORS
Helmet
Input Validation
File Validation
Upload Restrictions
Audit Logging
```

Never expose:

```text
Database credentials
JWT secret
Cloudinary API secret
Zoom client secret
Email credentials
```

in frontend code.


---


# 38. Environment Variables

## Frontend

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_YOUTUBE_CHANNEL_URL=
NEXT_PUBLIC_SITE_URL=
```

## Backend

```env
PORT=5000

DATABASE_URL=

JWT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
```


---


# 39. Project Structure

```text
astro-shantiram/
|
+-- frontend/
|   +-- app/
|   |   +-- [locale]/
|   |   |   +-- page.tsx
|   |   |   +-- about/
|   |   |   +-- astrology/
|   |   |   +-- horoscope/
|   |   |   +-- services/
|   |   |   +-- appointments/
|   |   |   +-- calendar/
|   |   |   +-- pravachan/
|   |   |   +-- books/
|   |   |   +-- articles/
|   |   |   +-- events/
|   |   |   +-- gallery/
|   |   |   +-- contact/
|   |   |
|   |   +-- admin/
|   |
|   +-- components/
|   +-- lib/
|   +-- hooks/
|   +-- types/
|   +-- messages/
|   |   +-- en.json
|   |   +-- ne.json
|   |   +-- sa.json
|   +-- public/
|
+-- backend/
|   +-- src/
|       +-- controllers/
|       +-- routes/
|       +-- services/
|       +-- middleware/
|       +-- models/
|       +-- integrations/
|       |   +-- zoom/
|       |   +-- cloudinary/
|       |   +-- youtube/
|       +-- utils/
|       +-- config/
|
+-- database/
|   +-- migrations/
|   +-- seed/
|
+-- docs/
|   +-- architecture.md
|   +-- api.md
|   +-- deployment.md
|
+-- README.md
```


---


# 40. Visual Design

## Design Direction

**Modern Himalayan / Sanatan Spiritual**

The visual language should communicate:

- Peace
- Wisdom
- Tradition
- Trust
- Spirituality
- Premium quality

## Suggested Colors

```text
Deep Saffron
Deep Maroon
Antique Gold
Cream
Warm White
Charcoal
```

## Visual Elements

Use subtle:

- Mandala patterns
- Himalayan landscapes
- Temple architecture
- Sanskrit patterns
- Lotus motifs
- Diyas
- Bells
- Sacred geometry

Avoid excessive decoration.


---


# 41. Typography

## English

Recommended:

```text
Playfair Display
Cormorant Garamond
```

## Nepali / Sanskrit

```text
Noto Sans Devanagari
Noto Serif Devanagari
```


---


# 42. Homepage Wireframe

```text
+--------------------------------------------------+
| LOGO | Home About Astrology Services Books ...   |
+--------------------------------------------------+
|                                                  |
|          ACHARYA SHANTIRAM KOIRALA              |
|                                                  |
|       Astrology • Spirituality • Wisdom          |
|                                                  |
|   [BOOK CONSULTATION] [WATCH PRAVACHAN]         |
|                                                  |
+--------------------------------------------------+
|                 ABOUT GURUJI                    |
+--------------------------------------------------+
|              ASTROLOGY SERVICES                 |
+--------------------------------------------------+
|                  HOROSCOPE                       |
+--------------------------------------------------+
|               UPCOMING EVENTS                   |
+--------------------------------------------------+
|                LATEST PRAVACHAN                 |
+--------------------------------------------------+
|                  BOOK LIBRARY                   |
+--------------------------------------------------+
|                  PUJA SERVICES                  |
+--------------------------------------------------+
|              DAILY SHLOKA / MANTRA              |
+--------------------------------------------------+
|               FACEBOOK UPDATES                  |
+--------------------------------------------------+
|                 TESTIMONIALS                    |
+--------------------------------------------------+
|                   CONTACT                       |
+--------------------------------------------------+
|                    FOOTER                       |
+--------------------------------------------------+
```


---


# 43. SEO

Every major content type should have:

```text
Title
Meta Description
Keywords
Open Graph Image
Canonical URL
Structured Data
```

Recommended Schema.org types:

```text
Person
Article
Book
Event
Service
VideoObject
FAQPage
```

SEO pages can include:

```text
/astrology
/horoscope
/services/rudrabhishek
/services/kundali
/books
/articles
/events
```


---


# 44. Performance

Target:

```text
Lighthouse > 90
```

Use:

- Next.js Image Optimization
- Cloudinary transformations
- Lazy loading
- Dynamic imports
- CDN caching
- Server-side rendering where useful
- Static generation for articles/books
- Optimized fonts
- Minimal JavaScript on public pages


---


# 45. Future Payment Integration

The architecture should remain payment-ready.

Possible providers:

```text
Stripe
Square
PayPal
```

Payments can eventually support:

- Astrology consultations
- Puja bookings
- Online classes
- Digital books
- Physical books
- Donations

Payment logic should remain independent of appointment logic so providers can be changed later.


---


# 46. Future PWA / Mobile App

The website can eventually become an installable PWA.

App name:

> Astro Shantiram

Potential notifications:

```text
Today's Horoscope
Upcoming Puja
New Pravachan
New Article
Appointment Reminder
Festival Reminder
```


---


# 47. Development Phases

## Phase 1 — Foundation

```text
Next.js frontend
Node.js backend
PostgreSQL
Authentication
Admin dashboard
Guru profile
Home
About
Contact
```

## Phase 2 — Content

```text
Articles
Books
YouTube
Facebook
Gallery
Events
```

## Phase 3 — Astrology

```text
Horoscope
Astrology Services
Consultation
Schedule
Calendar
```

## Phase 4 — Booking

```text
Appointments
Puja Requests
Availability
Notifications
Zoom API
```

## Phase 5 — Advanced Platform

```text
Panchang
Kundali
Payments
Subscriptions
Online Courses
Community Accounts
PWA
Notifications
```


---


# 48. Final Product Concept

Astro Shantiram should become:

```text
                    ASTRO SHANTIRAM
                           |
          +----------------+----------------+
          |                |                |
     SPIRITUALITY       ASTROLOGY        SERVICES
          |                |                |
      Pravachan        Horoscope          Puja
      Articles         Kundali            Havan
      Books            Muhurat            Rituals
      Mantra           Consultation       Events
          |                |                |
          +----------------+----------------+
                           |
                    DIGITAL COMMUNITY
                           |
              +------------+------------+
              |                         |
           YouTube                  Facebook
              |                         |
              +------------+------------+
                           |
                  ACHARYA SHANTIRAM
                       KOIRALA
```

## Product Principle

> **Astro Shantiram is a digital spiritual ecosystem connecting ancient wisdom, astrology, puja, education, and modern online services.**

The platform should be designed so that the initial website is simple and elegant, while the underlying architecture can grow into a complete astrology and spiritual platform without requiring a major rewrite.


---


# 49. Initial MVP Priority

The first production release should focus on:

```text
1. Premium spiritual homepage
2. Guru biography
3. Astrology services
4. Puja services
5. Horoscope
6. Interactive calendar
7. Appointment booking
8. Zoom consultation
9. YouTube integration
10. Facebook/social integration
11. Articles
12. Book upload and reader
13. Gallery
14. Events
15. Contact
16. English / Nepali / Sanskrit
17. Admin dashboard
18. Cloudinary media management
19. PostgreSQL database
20. Vercel deployment
```

This gives Astro Shantiram a strong foundation while leaving **Panchang, Kundali calculation, payments, courses, subscriptions, community accounts, and mobile/PWA functionality** for subsequent phases.
````
