# Prototype Hub

A private, password-protected platform for sharing HTML prototypes with your team.

## Features

- 🔐 Password-protected access (single shared team password)
- 📁 Organize prototypes in folders
- 👤 Author tracking and upload dates
- 🔄 Version updates — re-upload to replace a prototype
- 🖥 Full-screen prototype player with sandboxed iframes
- 🗑 Delete prototypes you no longer need

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env and set your SITE_PASSWORD and SESSION_SECRET

# 3. Run the server
npm start
# → http://localhost:3000
```

---

## Deploy to Railway (recommended — free tier, no server management)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create prototype-hub --private --push
   ```

2. **Create a Railway project**
   - Go to [railway.app](https://railway.app) and sign up (free)
   - Click **New Project → Deploy from GitHub repo**
   - Select your `prototype-hub` repo

3. **Set environment variables** in Railway dashboard → your service → Variables:
   ```
   SITE_PASSWORD = your-team-password
   SESSION_SECRET = some-long-random-string
   PORT = 3000
   ```

4. **Add a volume** for persistent file storage (so uploads survive deploys):
   - In Railway: your service → **Volumes** → Add Volume
   - Mount path: `/app/uploads`
   - Also add a second volume at `/app/data`

5. Railway will give you a public URL like `https://prototype-hub-production.up.railway.app`

---

## Deploy to Render (alternative free option)

1. Push to GitHub (same as above)
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Set:
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Add environment variables (same as Railway)
6. For persistent storage: Render's free tier doesn't support disks — upgrade to the $7/mo plan or use Railway instead

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SITE_PASSWORD` | Team login password | `changeme123` |
| `SESSION_SECRET` | Secret for session cookies | (insecure default) |
| `PORT` | Server port | `3000` |

**Always set `SITE_PASSWORD` and `SESSION_SECRET` in production.**

---

## File Storage Notes

Uploaded HTML files are stored in `uploads/` and prototype metadata in `data/prototypes.json`. On Railway/Render, mount these as persistent volumes or your uploads will be lost on each deploy.
