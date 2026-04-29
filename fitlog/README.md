# ⚡ FitLog — Deploy Guide

## What you need
- A free [GitHub](https://github.com) account
- A free [Vercel](https://vercel.com) account
- Your [Anthropic API key](https://console.anthropic.com) (the same one powering Claude)

---

## Step 1 — Put the project on GitHub

1. Go to [github.com/new](https://github.com/new)
2. Name it `fitlog`, keep it **private**, click **Create repository**
3. On your computer, open Terminal and run:

```bash
cd fitlog          # the folder you unzipped
git init
git add .
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fitlog.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `fitlog` repo
4. Leave all settings as default — Vercel will detect Vite automatically
5. Click **Deploy**

Your app will be live at `https://fitlog-xxxx.vercel.app` in about 60 seconds.

---

## Step 3 — Add your Anthropic API key

This is the important one — without it the chat won't work.

1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from [console.anthropic.com](https://console.anthropic.com) (starts with `sk-ant-...`)
3. Click **Save**
4. Go to **Deployments** and click **Redeploy** (top right) to apply it

---

## Step 4 — Install on your phone

**iPhone (Safari):**
1. Open your Vercel URL in Safari
2. Tap the Share button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

**Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap the 3-dot menu
3. Tap **Add to Home Screen**

It will open full-screen like a native app, no browser bar.

---

## Cost

- **Vercel:** Free (Hobby plan is plenty for personal use)
- **GitHub:** Free (private repos included)
- **Anthropic API:** Pay per use — logging a workout costs roughly $0.001. Scanning a nutrition label ~$0.005. You'd need to use it hundreds of times a day to spend even $1.

---

## Updating the app

Any time you want to change something:

```bash
# make your changes, then:
git add .
git commit -m "update"
git push
```

Vercel auto-deploys on every push. Live in ~30 seconds.

---

## Migrating to a real database later

Right now data lives in your browser's localStorage. It works great on one device.
When you're ready to sync across devices, the move is [Supabase](https://supabase.com) (free tier).
That's a separate step — get it deployed and working first.
