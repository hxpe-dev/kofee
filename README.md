<div align="center">

# ☕ Kofee

**A minimal, beautiful code snippet manager for developers.**

*Your brew of code.*

</div>

> [!NOTE]
> **Kofee is just getting started.**  
> We're running on free-tier infrastructure while we find our footing.  
> If you try it and enjoy it, consider [supporting the project](https://ko-fi.com/hxpedev), it directly helps us scale beyond the free tier and keep building.  
> **Feedback**, **bug reports**, and **stars** on the repo mean just as much. ☕

---

**Kofee** is an open source snippet manager built for developers who care about their tools.  
Save, tag, search, and publish your code snippets with GitHub Gist integration baked in. Warm aesthetic and fast.

---

## Features

- **Snippet editor** with full syntax highlighting (JS, TS, Python, CSS, SQL, HTML, Bash, JSON)
- **Tag system**: organize and filter your snippets by tag
- **GitHub Gist integration**: push any snippet to a private Gist in one click
- **Import from Gist**: paste a Gist URL and import it instantly
- **Brew mode**: distraction-free fullscreen editor
- **Download snippets**: export a single snippet or all of them as a `.zip`
- **Auto-save**: your work is saved automatically as you type
- **Keyboard shortcuts**: go fast brrr
- **Login with GitHub**: no passwords, no forms
- **Guest mode**: for people that don't want to login
- **Snippet sharing**: share snippets with others
- **Warm, minimal UI**: dark coffee-toned theme built

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16.2](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Auth | [Supabase Auth](https://supabase.com/docs/guides/auth) (GitHub OAuth) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Code editor | [CodeMirror 6](https://codemirror.net) via `@uiw/react-codemirror` |
| Styling | CSS Modules |
| Deployment | [Vercel](https://vercel.com) |
| Rate limiting | [Upstash](https://upstash.com) (Redis) |

---

## Getting Started

### Prerequisites

- Node.js
- A [Supabase](https://supabase.com) account (free)
- An [Upstash](https://upstash.com) account (free)
- A [GitHub OAuth App](https://github.com/settings/developers)

### 1. Clone the repo

```bash
git clone https://github.com/hxpe-dev/kofee.git
cd kofee
npm install
```

### 2. Set up Supabase

Create a new Supabase project, then run the schema file in the SQL Editor:

```bash
# The full schema is at:
supabase/schema.sql
```

Enable GitHub as an auth provider in Supabase:
- Go to **Authentication -> Providers -> GitHub**
- Enter your GitHub OAuth App credentials
- Set the callback URL to: `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 3. Set up your GitHub OAuth App

Go to [github.com/settings/developers](https://github.com/settings/developers) -> New OAuth App:

- **Homepage URL:** `http://localhost:3000`
- **Callback URL:** `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 4. Configure environment variables

Create a `.env.local` file at the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
TOKEN_ENCRYPTION_KEY=your_32_character_secret_key_here
```

Generate a secure encryption key:
```bash
openssl rand -base64 32
```

### 5. Set up Upstash rate limiting

Create a free [Upstash](https://upstash.com) Redis database, then add to `.env.local`:
```env
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

Also add these to your Vercel environment variables when deploying.

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with GitHub.

---

## Deploying to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https%3A%2F%2Fgithub.com%2Fhxpe-dev%2Fkofee%2Ftree%2Fmain)

1. Push your repo to GitHub
2. Import it on [vercel.com](https://vercel.com)
3. Add your environment variables in the Vercel dashboard
4. Update your GitHub OAuth App callback URL to your production domain
5. Deploy

---

## Database Schema

The full reproducible schema lives at [`supabase/schema.sql`](supabase/schema.sql).

It includes:
- `snippets` table with RLS policies
- `user_tokens` table for encrypted GitHub tokens (also with RLS)
- Indexes on `user_id` and `updated_at`

---

## Security

- GitHub OAuth tokens are **encrypted at rest** using AES-GCM before being stored in the database
- The encryption key lives in your environment variables and never touches the database
- Row Level Security (RLS) is enabled on all tables, users can only access their own data
- The Supabase publishable key is safe to expose publicly by design
- API routes are **rate limited** using Upstash Redis, 10 requests per minute per user on Gist endpoints
- Snippet content is stored unencrypted, avoid storing sensitive credentials directly in snippets
- Each user is limited to **100 snippets**, enforced at the database level via a PostgreSQL trigger

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `N` | New snippet (when not typing) |
| `S` | Force save current snippet |
| `B` | Toggle Brew mode |
| `Enter` in title | Jump to code editor |
| `Escape` | Deselect snippet / exit Brew mode |

---

## Contributing

Contributions are very welcome, whether it's a bug fix, a new feature, or just improving the docs.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Open a pull request with a clear description of what you changed and why

Please keep PRs focused, one feature or fix per PR makes review much easier!

If you're not sure whether something fits the project vision, open an issue first to discuss it.

---

## Roadmap

Some ideas for future versions, contributions welcome:

- [ ] Collections / folders for snippets
- [ ] Public snippet profiles
- [ ] Snippet aging indicator (cold snippets you haven't used)
- [ ] VS Code extension
- [x] Mobile-friendly layout
- [x] Import from local files

---

## License & Commercial Use

Kofee is open-source under the [MIT License](LICENSE) You are free to use, modify, and contribute.  

⚠️ While the license allows commercial use legally, please **do not deploy a competing service** based on Kofee without permission.  
Your support, contributions, and feedback are what help Kofee grow!

---

## Support the project

Kofee is free and open source. If you find it useful and want to support its development, donations are appreciated and go directly toward keeping the project alive!

> 💛 [Buy me a coffee](https://ko-fi.com/hxpedev)

---

Built with ☕ by [hxpe](https://github.com/hxpe-dev)  
If you enjoy **Kofee**, consider starring the [GitHub repository](https://github.com/hxpe-dev/kofee)!
