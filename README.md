This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Architecture

One chat message crosses the browser boundary exactly twice — once in, once back out. Everything else (talking to the LLM, and, when the model asks for a tool, talking to Zoho CRM) happens inside a single server-side route. That route is the only place OAuth tokens and API keys are allowed to live.

```
                                            LLM provider
                                     (Gemini · gemini-3.5-flash)
                                                  ^ |
                2. prompt + tool                  | |
                schemas + history                 | |
                                                  | v 3. tool_call, or final reply
Browser (Chat UI) --1. user message--> Next.js API route --4. OAuth REST call--> Zoho CRM REST API
                  <-6. streamed reply-  (/api/chat)      <-5. record result---    (Leads . Deals . Cases)
```



