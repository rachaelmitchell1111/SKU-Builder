# Contributing to SKU Builder

Thank you for your interest in contributing! Follow the steps below to make your first commit.

## Prerequisites

- [Git](https://git-scm.com/) installed on your machine
- A [GitHub](https://github.com/) account
- The project set up locally (see [README.md](README.md))

## How to Commit

### 1. Fork the repository

Click the **Fork** button at the top-right of the GitHub repository page to create your own copy.

### 2. Clone your fork

```bash
git clone https://github.com/<your-username>/SKU-Builder.git
cd SKU-Builder
```

### 3. Create a feature branch

Always work on a dedicated branch rather than directly on `main`:

```bash
git checkout -b feature/your-feature-name
```

Use a descriptive branch name, e.g. `feature/add-search-endpoint` or `fix/sku-generation-bug`.

### 4. Make your changes

Edit files, add new files, or remove files as needed. Then verify your changes work as expected by running the app locally:

```bash
npm run dev
```

### 5. Stage your changes

Add only the files you intentionally changed:

```bash
# Stage specific files
git add path/to/file.js

# Or stage all modified and new files
git add .
```

You can review what is staged before committing:

```bash
git status
git diff --staged
```

### 6. Write a clear commit message

```bash
git commit -m "Short summary of the change"
```

**Commit message guidelines:**

- Use the imperative mood: *"Add feature"* not *"Added feature"*
- Keep the subject line under 72 characters
- Reference an issue number when relevant: `"Fix SKU generation for long colors (#12)"`

Examples of good commit messages:

```
Add DELETE endpoint for inventory items
Fix SKU uniqueness check on item update
Update README with setup instructions
```

### 7. Push your branch to GitHub

```bash
git push origin feature/your-feature-name
```

### 8. Open a Pull Request

1. Go to your fork on GitHub.
2. Click **Compare & pull request**.
3. Fill in a clear title and description explaining *what* you changed and *why*.
4. Submit the pull request for review.

## Keeping Your Fork Up to Date

If the upstream repository has changed since you forked it, sync your local copy before starting new work:

```bash
git remote add upstream https://github.com/rachaelmitchell1111/SKU-Builder.git
git fetch upstream
git checkout main
git merge upstream/main
```

## Code Style

- Follow the existing code patterns in the repository.
- Keep functions small and focused.
- Avoid committing `.env` files or secrets — they are listed in `.gitignore`.

## Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/rachaelmitchell1111/SKU-Builder/issues) before starting work so we can discuss the best approach.
