# Deploying Slides to the NoeMI Website

The NoeMI website is a React SPA on Firebase Hosting with a catch-all rewrite to `index.html`.
To serve the Slidev static build, we need to add a rewrite exception in `firebase.json`.

## Step 1: Build the distribution package

```bash
cd presentations
npm install
npx slidev build slides.md    # outputs to ./dist/
```

## Step 2: Copy dist to the website repo

```bash
# From the agents repo root
cp -r presentations/dist/ ../noemi-website/public/slides/
```

## Step 3: Update firebase.json in noemi-website

Add this rewrite rule BEFORE the catch-all `"source": "**"` rule:

```json
{
  "hosting": {
    "rewrites": [
      { "source": "/slides/**", "destination": "/slides/index.html" },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

## Step 4: Deploy

```bash
cd ../noemi-website
npm run deploy:prod
```

The slides will be available at: `https://your-domain.com/slides/`

## Claude Code instructions for noemi-website

If handing this to Claude in the noemi-website repo:

> Read presentations/DEPLOY-TO-WEBSITE.md from the agents repo. Copy the
> contents of presentations/dist/ into public/slides/. Update firebase.json
> to add a "/slides/**" rewrite rule before the catch-all SPA rewrite.
> Then deploy with `npm run deploy:prod`.
