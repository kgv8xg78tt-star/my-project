import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjects, type ProjectSummary } from "../api/kolpakoffApi";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; projects: ProjectSummary[] };

export default function ProjectsPage() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchProjects();
        if (cancelled) return;
        setState({ status: "loaded", projects: data.projects });
      } catch (e) {
        if (cancelled) return;
        setState({ status: "error", message: e instanceof Error ? e.message : "Failed to load projects" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const content = useMemo(() => {
    if (state.status === "loading") {
      return (
        <main className="page page--home">
          <div className="page-state page-state--home">Загрузка проектов…</div>
        </main>
      );
    }
    if (state.status === "error") {
      return (
        <main className="page page--home">
          <div className="page-state page-state--home page-state--error">{state.message}</div>
        </main>
      );
    }

    if (state.projects.length === 0) {
      return (
        <main className="page page--home">
          <div className="page-state page-state--home">Проекты не найдены.</div>
        </main>
      );
    }

    return (
      <main className="page page--home">
        <header className="home-hero">
          <div className="home-hero__decor" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <h1 className="home-hero__title">Выберите проект</h1>
          <p className="home-hero__sub">
            Рендеры, планировки и комплектации в одном месте — затем сформируйте персональное коммерческое предложение в
            PDF для клиента.
          </p>
        </header>

        <div className="home-projects">
          <div className="project-grid">
            {state.projects.map((p) => {
              const preview = p.renderUrls[0];
              const displayName = p.name.replace(/^Проект\s+/u, "");
              return (
                <button
                  key={p.id}
                  type="button"
                  className="project-card-home"
                  onClick={() => navigate(`/commercial-offers/${p.id}`)}
                >
                  <div className="project-card-home__media">
                    {preview ? (
                      <img src={preview} alt="" loading="lazy" />
                    ) : (
                      <div className="project-card-home__placeholder">Нет превью</div>
                    )}
                  </div>
                  <div className="project-card-home__body">
                    <h2 className="project-card-home__name">{displayName}</h2>
                    <p className="project-card-home__hint">Планировки, комплектации и КП</p>
                    <div className="project-card-home__arrow">Открыть →</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    );
  }, [navigate, state]);

  return <>{content}</>;
}
