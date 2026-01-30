import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Script from 'next/script'
import { ThemeProvider } from '@/components/theme-provider'
import { TaskCenter } from '@/components/task-center'
import './globals.css'

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'AI Workspace Platform',
  generator: 'workspace',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <Script id="rewrite-external-cdn-config" strategy="beforeInteractive">
        {`
          (function () {
            try {
              var originalFetch = window.fetch;
              if (!originalFetch || originalFetch.__rewritten_for_workspace__) return;

              var cdnUrls = [
                "https://cdn.jsdelivr.net/gh/foyer-work/cdn-files@latest/quill/config.json",
                "https://fastly.jsdelivr.net/gh/foyer-work/cdn-files@latest/quill/config.json"
              ];

              function shouldRewrite(url) {
                if (!url) return false;
                for (var i = 0; i < cdnUrls.length; i++) {
                  if (url.indexOf(cdnUrls[i]) >= 0) return true;
                }
                return false;
              }

              function rewriteToLocal(url) {
                // Served from public/quill/config.json
                return "/quill/config.json";
              }

              var wrapped = function (input, init) {
                try {
                  var url = null;
                  if (typeof input === "string") url = input;
                  else if (input && typeof input.url === "string") url = input.url;
                  else if (input && input.href) url = input.href;

                  if (shouldRewrite(url)) {
                    var localUrl = rewriteToLocal(url);
                    if (typeof input === "string") {
                      return originalFetch.call(this, localUrl, init).catch(function () {
                        return originalFetch.call(this, input, init);
                      }.bind(this));
                    }
                    var req = new Request(localUrl, input);
                    return originalFetch.call(this, req, init).catch(function () {
                      return originalFetch.call(this, input, init);
                    }.bind(this));
                  }
                } catch (e) {}
                return originalFetch.call(this, input, init);
              };
              wrapped.__rewritten_for_workspace__ = true;
              window.fetch = wrapped;
            } catch (e) {}
          })();
        `}
      </Script>
      <body
        suppressHydrationWarning
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
          <TaskCenter />
        </ThemeProvider>
      </body>
    </html>
  )
}
