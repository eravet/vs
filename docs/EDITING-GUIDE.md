# Editing the Velo-Savvy website

A guide for Mark. No technical knowledge needed.

## Logging in

1. Go to **www.velo-savvy.com/admin/**
2. Click **Login with Netlify Identity** and sign in with your email and password.
   (The first time, use the invite email to set your password.)
3. You'll see three sections on the left: **Journal posts**, **Pages** and **Settings**.

After you click **Publish**, the website updates by itself in about one minute.

---

## Writing a new Journal post

1. Click **Journal posts** → **New Journal post**.
2. Fill in:
   - **Title**: the headline.
   - **Date**: the day you're publishing.
   - **Short summary**: 1–2 sentences. This shows on the Journal page and in Google.
   - **Topic**: pick one (Training Tips, Nutrition, Recovery, Mindset, Race Strategy, Equipment).
   - **Main photo**: click *Choose an image* → *Upload*. Wide (landscape) photos look best.
   - **Describe the photo**: a few words, e.g. "Riders on a cobbled climb".
   - **Photo credit**: if the photo isn't yours, e.g. `Photo: Jane Smith on Unsplash`.
   - **Keywords**: optional.
   - **Post**: write the newsletter here. The toolbar has headings, bold, lists and links.
     To add a photo in the middle of a post, click **+** → **Image**.
3. Click **Publish** → **Publish now**.

**Tip: drafts.** Switch **Published** off to save a post without showing it on the site.
You can come back and switch it on later.

**Tip: pasting your newsletter.** Paste the text into the **Post** box, then use the
toolbar to turn section titles ("Training Insight", "Athlete Spotlight"…) into
**Heading 2**. They'll get the bold condensed style automatically.

### Where to find free photos
- **Unsplash** (unsplash.com) and **Pexels** (pexels.com): free to use. Credit the photographer.
- **Wikimedia Commons** (commons.wikimedia.org): good for photos of pro riders. You **must**
  credit the photographer and licence, e.g. `Photo: Jane Smith, CC BY-SA 4.0, via Wikimedia Commons`.
- **Don't** use photos from news sites, Getty, team sites or Google Images. They're copyrighted.

---

## Changing a page

Click **Pages**, then the page:

| Page | What you can change |
|---|---|
| **Home page** | Banner headline, text and photo; the four highlights; "How it works" steps; the bottom call to action |
| **About Mark page** | Your story, your photo, the wide photo, the timeline, your coaching philosophy |
| **Coaching plans & prices** | Plan names, prices, what's included, single sessions, FAQ, the referral offer |
| **Camps, clinics & training plans** | Each clinic, camp and ready-made plan: description, dates, price and status |
| **Juniors team page** | Team info, coaches, results, parent questions, sponsors |
| **Group rides** | Weekly rides and one-off special rides |
| **Athlete hub** | TrainingPeaks, billing, waiver and Google review links; guides for athletes |
| **Rider testimonials** | Add a quote, or switch **Show on site** off to hide one |

### Announcing a clinic or camp
1. **Pages → Camps, clinics & training plans**, then open the section and the program.
2. Fill in **When** (e.g. "Saturday March 14, 8–11am") and **Price**.
3. Change **Status** to **Open for booking** and paste a **Booking link** (Stripe payment link,
   BikeReg, a TrainingPeaks plan…). A "Book a place" button appears.
4. While a program is **Coming soon**, visitors can leave their email to hear when it's on.
   Those emails arrive as Netlify form submissions ("program-interest").

### Selling a ready-made plan
Create the plan in the TrainingPeaks store, then paste its store link into that plan's
**Booking link** and set **Status** to **Open for booking**.

### Special rides
Add a ride under **Group rides → Special rides & events** (e.g. a Hugel prep ride). Delete it
once it's over. The section disappears when it's empty.

Lists (plans, timeline rows, FAQ…) can be **dragged** to reorder, and each has
**Add** and **Delete** buttons.

## Settings

**Settings → Contact & site settings** holds your email, phone, social links and the
newsletter signup box. If you start using Calendly (or similar), paste your link into
**Booking link** and a "Pick a time on my calendar" button appears on the Contact page.

---

## Messages and newsletter signups

- Contact-form messages and newsletter signups are collected by Netlify.
  Eric can set Netlify to email each one to you.
- To export newsletter emails (e.g. into Mailchimp): Netlify → *Forms* → *newsletter* → *Download CSV*.

## Something looks wrong?

Every change is saved in history, so nothing can be permanently broken.
Message Eric with the page and what you changed, and he can roll it back.
