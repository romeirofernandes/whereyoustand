import React from "react";

const credits = [
	{
		name: "Chris Lopes",
		role: "Scraper and Pointer Calculator",
		github: "https://github.com/Chris-Lopes",
	},
	{
		name: "Aliqyaan Mahimwala",
		role: "Cron Job and Mailer",
		github: "https://github.com/Hike-12",
	},
];

export function SiteFooter() {
	return (
		<footer className="w-full border-t bg-card text-muted-foreground text-sm py-6 px-4 flex flex-col items-center gap-2">
			<div className="flex flex-col sm:flex-row gap-2 items-center">
				{credits.map((person, idx) => (
					<span key={person.name} className="flex items-center gap-1.5">
						<a
							href={person.github}
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-primary transition-colors flex items-center gap-1"
							aria-label={`GitHub profile of ${person.name}`}
						>
							<span className="font-medium">{person.name}</span>
						</a>
						<span className="opacity-70">–&nbsp;{person.role}</span>
						{idx < credits.length - 1 && (
							<span className="mx-2 text-foreground select-none hidden sm:inline">
								|
							</span>
						)}
					</span>
				))}
        <span className="mx-2 text-foreground select-none hidden sm:inline">
          |
        </span>
				<a
					href="https://github.com/romeirofernandes/whereyoustand"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 hover:text-primary transition-colors"
				>
					<GitHubLogo className="w-8 h-8" />
					<span>Star the repo pls</span>
				</a>
			</div>
		</footer>
	);
}

function GitHubLogo({ className = "" }) {
  // Minimal GitHub mark, matches theme
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ display: "inline", verticalAlign: "middle" }}
    >
      <circle cx="8" cy="8" r="8" fill="var(--foreground #888)" />
      <path
        fill="var(--foreground, #222)"
        d="M8 3.25c-2.62 0-4.75 2.13-4.75 4.75 0 2.1 1.36 3.88 3.25 4.51.24.04.33-.1.33-.23v-.82c-1.33.29-1.61-.64-1.61-.64-.22-.56-.54-.71-.54-.71-.44-.3.03-.29.03-.29.48.03.74.5.74.5.43.74 1.13.53 1.41.41.04-.31.17-.53.31-.65-1.06-.12-2.18-.53-2.18-2.36 0-.52.19-.94.5-1.27-.05-.12-.22-.6.05-1.25 0 0 .41-.13 1.33.5.39-.11.81-.16 1.23-.16.42 0 .84.05 1.23.16.92-.63 1.33-.5 1.33-.5.27.65.1 1.13.05 1.25.31.33.5.75.5 1.27 0 1.84-1.12 2.24-2.19 2.36.18.16.34.47.34.95v1.41c0 .13.09.28.34.23 1.89-.63 3.25-2.41 3.25-4.51 0-2.62-2.13-4.75-4.75-4.75z"
      />
    </svg>
  );
}
