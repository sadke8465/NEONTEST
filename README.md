# Neon WebAR Experience

This is a WebAR application using Three.js and MediaPipe.

## How to Host on GitHub Pages

1.  **Create a New Repository on GitHub:**
    *   Go to [github.com/new](https://github.com/new).
    *   Name your repository (e.g., `neon-ar-experience`).
    *   Keep it **Public** (required for free GitHub Pages).
    *   Do **not** initialize with README, .gitignore, or license (we already have code).
    *   Click **Create repository**.

2.  **Push Your Code:**
    *   Copy the commands from the section **"…or push an existing repository from the command line"**.
    *   They will look like this (replace `YOUR_USERNAME` and `REPO_NAME`):
        ```bash
        git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
        git branch -M main
        git push -u origin main
        ```
    *   Run these commands in your terminal.

3.  **Enable GitHub Pages:**
    *   Go to your repository **Settings** tab.
    *   Click on **Pages** in the left sidebar.
    *   Under **Source**, select **Deploy from a branch**.
    *   Under **Branch**, select `main` and `/ (root)`.
    *   Click **Save**.

4.  **Access Your Site:**
    *   Wait a minute or two.
    *   Refresh the Pages settings page.
    *   You will see your URL at the top (e.g., `https://your-username.github.io/repo-name/`).
    *   **Note:** You must use HTTPS (which GitHub Pages does automatically) for the camera to work.
