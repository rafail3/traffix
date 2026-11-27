"use client";

import { Star } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { siGithub } from "simple-icons";
import { Mark } from "./Mark";

const REPO_URL = "https://github.com/rafail3/traffix";

function useStars() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("https://api.github.com/repos/rafail3/traffix", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((repo) => { if (typeof repo?.stargazers_count === "number") setStars(repo.stargazers_count); })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return stars;
}

/** "Star it / help on GitHub" panel, next to the Android one. Website only. */
export function GitHubCard({ id }: { id: string }) {
  const stars = useStars();
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-head">
        <Mark icon={siGithub} size={24} className="panel-icon" />
        <h2 id={id}>Traffix e open source</h2>
      </div>
      <p className="panel-text">Dacă îți place jocul, lasă-i o stea pe GitHub. Codul e public, deci poți veni și cu idei sau cu îmbunătățiri.</p>
      <a
        className="btn block"
        href={REPO_URL}
        target="_blank"
        rel="noopener"
        aria-label={stars === null ? undefined : `Dă o stea pe GitHub, ${stars} ${stars === 1 ? "stea" : "stele"} până acum`}
      >
        <Star size={18} weight="bold" aria-hidden="true" />
        Dă o stea pe GitHub
        {stars !== null && (
          <span className="star-count" aria-hidden="true">{stars}</span>
        )}
      </a>
      <a className="panel-link" href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener">
        Cum poți contribui
      </a>
    </section>
  );
}
