# FIBC Louisville Website

This is the official website for **Filipino International Baptist Church (FIBC) Louisville**, built with **Angular 17**, deployed via **Netlify**, and connected to a custom domain at [fibclouisville.org](http://fibclouisville.org/).

The site is designed to be modern, responsive, and community-focused, with pages for worship, history, leadership, contact, and more.

---

## 🚀 Project Overview

- **Framework**: Angular 17 (standalone components, SCSS)
- **Hosting**: Netlify (auto-deploys from GitHub main branch)
- **Domain**: fibclouisville.org
- **Auth**: Auth0 (for account login/management – WIP)
- **Forms**: Netlify Forms (for Contact page submissions)
- **Deployment**: CI/CD from GitHub → Netlify

---

## 📂 Current Pages & Features

### Core Layout
- **Header**: Sticky navigation bar with responsive hamburger menu for mobile.
  - Links to Home, About, History, Leaders, Contact, Visit, Donate.
  - Includes **Donate** button (accent style).
  - Displays church **logo** as part of the brand.
- **Footer**: Church info, addresses, phone, email, and links to Facebook / Instagram / KY Baptist directory.

### Pages
- **Home**
  - Hero image with welcoming message + call-to-action.
  - Mission statement block (“Worship, Share, Equip”).
  - Welcome section with church intro + “Discover Our Story” button (routerLink to About).
  - Animations: fade-in / fade-up on scroll for liveliness.
- **About**
  - Church background & embedded YouTube documentary.
- **History**
  - Church historical milestones.
- **Leaders (Members)**
  - Dynamic grid layout, auto-formats for any number of leaders.
  - Data loaded from `assets/data/members.json`.
- **Contact**
  - Card-based layout:
    - Church info & addresses.
    - Social links.
    - **Contact form** (Netlify Forms, spam-protected, submissions visible in Netlify dashboard).
- **Visit**
  - Service meeting address.
  - Embedded Google Maps location.
- **Donate**
  - Donation instructions & Zelle QR link.
- **Not Found (404)**
  - Custom page with friendly message + button to return Home.
- **Gallery** (in progress)
  - Planned: auto-pull latest photos from Facebook page.
  - Current: placeholder setup with grid layout.

---

## 🛠 Development

### Install dependencies
```sh
npm install
