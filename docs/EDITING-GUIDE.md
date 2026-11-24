# Editing the Velo-Savvy website

A guide for Mark. No technical knowledge needed.

## Logging in

**First time only:** make a free account at **github.com** and send Eric your username. You'll get
an email from GitHub inviting you to the website's project: click **Accept invitation**.
(GitHub is where the website's files are stored. You won't need to do anything else there.)

1. Go to **www.velo-savvy.com/admin/**
2. Click **Login with GitHub**. The first time, GitHub asks you to authorise "Velo-Savvy editor":
   click **Authorize**. After that you'll stay logged in on that computer.
3. You'll see three sections on the left: **Journal posts**, **Pages** and **Settings**.

**Saving and going live are two steps.** **Save** keeps your changes, but the website doesn't change
yet. When you're ready (one change or ten), click **Go live** at the bottom left. The website
updates about two minutes later, with everything you've saved. The box at the bottom left always
says how many saved changes are waiting; hover over it to see which.

Why: the website's free hosting allows about 20 updates a month, so it's best to save as often as
you like and go live once when you're done.

---

## Writing a new Journal post

1. Click **Journal posts** → **+ Journal post** → **Blank post**.
2. Fill in:
   - **Title**: the headline.
   - **Date**: the day you're publishing.
   - **Short summary**: 1–2 sentences. This shows on the Journal page and in Google.
   - **Topic**: pick one (Training Tips, Nutrition, Recovery, Mindset, Race Strategy, Equipment).
   - **Main photo**: click *Choose an image* → *Upload*. Wide (landscape) photos look best.
   - **Describe the photo**: a few words, e.g. "Riders on a cobbled climb".
   - **Photo credit**: if the photo isn't yours, the photographer's name linked to the photo's
     page, e.g. `Photo: [Jane Smith](https://unsplash.com/photos/...)`.
   - **Keywords**: optional.
   - **Post**: write the newsletter here. The toolbar has headings, bold, lists and links.
     To add a photo in the middle of a post, click **+** → **Image**.
3. Click **Save** → **Save now**. Then click **Go live** (bottom left) when you're ready.

**Tip: drafts.** Switch **Published** off to save a post without showing it on the site.
You can come back and switch it on later.

**Tip: pasting your newsletter.** Paste the text into the **Post** box, then use the
toolbar to turn section titles ("Training Insight", "Athlete Spotlight"…) into
**Heading 2**. They'll get the bold condensed style automatically.

### Drafting a post with AI
1. Click **+ Journal post** → **✍️ Draft with AI**.
2. Type your notes: the idea, ride stories, a rider to feature, links. Rough is fine.
   Pick a topic or let the AI choose, then click **Write draft** (20–40 seconds).
3. Read the draft. Anything marked **⚠️ check** is a fact the AI added: check it, fix it or delete it.
4. Pick a photo, or search under **Search for other photos**. Short searches work best
   ("cycling peloton", "bicycle race", a rider's name). The photos are free to use, and the photographer
   and licence are credited automatically. If none fit, choose **No photo for now** and upload
   your own in the editor.
5. Click **Save draft and open in the editor**. The post opens with **Published** switched off.
   Finish it there, switch **Published** on, **Save**, then **Go live**.

To change how the AI writes (your voice, length, structure, which posts to copy, what photos to
look for), go to **Settings → AI writing settings**. Changes apply to the next draft.

### Where to find free photos
- **Unsplash** (unsplash.com) and **Pexels** (pexels.com): free to use. Credit the photographer
  with a link, e.g. `Photo: [Jane Smith](link to the photo)`.
- **Wikimedia Commons** (commons.wikimedia.org): good for photos of pro riders. You **must**
  credit the photographer **and name the licence** shown on the photo's page, e.g.
  `Photo: [Jane Smith](link to the photo), CC BY-SA 4.0`. Licence names start with "CC"; if the
  page says "CC0" or "public domain", no licence name is needed.
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
