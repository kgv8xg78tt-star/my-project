import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { CommercialOfferRequest, Manager, Project } from "../api/kolpakoffApi";
import { fetchManagers, fetchProjectDetails, generateCommercialOfferPdf } from "../api/kolpakoffApi";
import ImageLightbox from "../components/ImageLightbox";
import RenderCarousel from "../components/RenderCarousel";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; project: Project; managers: Manager[] };

function formatPriceRub(priceRub: number): string {
  const n = Number.isFinite(priceRub) ? priceRub : 0;
  return `${new Intl.NumberFormat("ru-RU").format(n)} руб.`;
}

/** Три колонки слева направо: сначала заполняется первая, затем вторая, третья (как строки чтения). */
function packagesInThreeColumns<T>(items: T[]): [T[], T[], T[]] {
  const n = items.length;
  if (n === 0) return [[], [], []];
  const base = Math.floor(n / 3);
  const rem = n % 3;
  const sizes: [number, number, number] = [
    base + (rem > 0 ? 1 : 0),
    base + (rem > 1 ? 1 : 0),
    base + (rem > 2 ? 1 : 0),
  ];
  let start = 0;
  const cols = sizes.map((size) => {
    const slice = items.slice(start, start + size);
    start += size;
    return slice;
  });
  return [cols[0]!, cols[1]!, cols[2]!];
}

function PackageDescriptionTable({ description }: { description: string }) {
  const lines = description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <table className="package-spec-table">
      <tbody>
        {lines.map((line, i) => {
          const colon = line.indexOf(":");
          if (colon === -1) {
            return (
              <tr key={i} className="package-spec-table__full">
                <td colSpan={2}>
                  <span className="package-spec-bullet" aria-hidden>
                    ●
                  </span>{" "}
                  {line}
                </td>
              </tr>
            );
          }
          const label = line.slice(0, colon).trim();
          const value = line.slice(colon + 1).trim();
          return (
            <tr key={i}>
              <th scope="row">{label}</th>
              <td>{value || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [layoutId, setLayoutId] = useState<string>("");
  const [packageId, setPackageId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [fio, setFio] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

  useEffect(() => {
    if (!projectId) {
      setState({ status: "error", message: "ProjectId отсутствует в URL" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [projData, managersData] = await Promise.all([
          fetchProjectDetails(projectId),
          fetchManagers(),
        ]);

        if (cancelled) return;

        const project = projData.project;
        const managers = managersData.managers;

        setState({ status: "loaded", project, managers });

        setLayoutId(project.layouts[0]?.id ?? "");
        setPackageId(project.packages[0]?.id ?? "");
        setManagerId(managers[0]?.id ?? "");
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load project",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function onDownloadPdf() {
    if (state.status !== "loaded") return;

    setSubmitError(null);

    const payload: CommercialOfferRequest = {
      projectId: state.project.id,
      layoutId: layoutId,
      packageId: packageId,
      managerId: managerId,
      fio: fio.trim(),
      phone: phone.trim(),
    };

    if (!payload.fio) {
      setSubmitError("Укажите ФИО");
      return;
    }
    if (!payload.phone) {
      setSubmitError("Укажите номер телефона");
      return;
    }
    if (!payload.layoutId) {
      setSubmitError("Выберите планировку");
      return;
    }
    if (!payload.packageId) {
      setSubmitError("Выберите комплектацию");
      return;
    }
    if (!payload.managerId) {
      setSubmitError("Выберите менеджера");
      return;
    }

    try {
      setSubmitting(true);
      const { blob, filename } = await generateCommercialOfferPdf(payload);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `Коммерческое_предложение.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Не удалось сформировать PDF");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <main className="page">
        <div className="page-state">Загрузка…</div>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="page">
        <div className="page-state page-state--error">{state.message}</div>
      </main>
    );
  }

  const project = state.project;
  const managers = state.managers;

  const selectedLayout = project.layouts.find((l) => l.id === layoutId) ?? project.layouts[0];
  const selectedPack = project.packages.find((p) => p.id === packageId) ?? project.packages[0];
  const selectedManager = managers.find((m) => m.id === managerId) ?? managers[0];

  return (
    <main className="page">
      <ImageLightbox
        open={Boolean(lightbox)}
        src={lightbox?.src ?? null}
        alt={lightbox?.label ?? ""}
        onClose={() => setLightbox(null)}
      />

      <div className="project-hero">
        <div className="project-hero__meta">Карточка объекта</div>
        <h1>{project.title}</h1>
      </div>

      <section className="flow-section" aria-labelledby="sec-renders">
        <div className="flow-section__head">
          <h2 className="flow-section__title" id="sec-renders">
            <span className="flow-section__step" aria-hidden>
              1
            </span>{" "}
            Визуализация проекта
          </h2>
        </div>
        <RenderCarousel urls={project.renderUrls} altBase={project.title} />
      </section>

      <section className="flow-section" aria-labelledby="sec-layouts">
        <div className="flow-section__head">
          <h2 className="flow-section__title" id="sec-layouts">
            <span className="flow-section__step" aria-hidden>
              2
            </span>{" "}
            Планировки
          </h2>
        </div>

        <div className="layout-grid">
          {project.layouts.map((l) => {
            const isActive = l.id === layoutId;
            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                className={"choice-tile layout-card glass" + (isActive ? " is-selected" : "")}
                onClick={() => setLayoutId(l.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLayoutId(l.id);
                  }
                }}
                style={{
                  border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
                  padding: 12,
                  overflow: "hidden",
                }}
              >
                <span className="choice-tile__badge">Выбрано</span>
                <div style={{ fontWeight: 700, marginBottom: 10, paddingRight: 88 }}>{l.label}</div>
                <div
                  className="img-wrapper"
                  style={{
                    position: "relative",
                    height: 160,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    background: "rgba(15,23,42,.04)",
                  }}
                >
                  <img src={l.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    type="button"
                    className="layout-enlarge-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox({ src: l.imageUrl, label: l.label });
                    }}
                  >
                    Увеличить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flow-section" aria-labelledby="sec-packages">
        <div className="flow-section__head">
          <h2 className="flow-section__title" id="sec-packages">
            <span className="flow-section__step" aria-hidden>
              3
            </span>{" "}
            Комплектации
          </h2>
        </div>

        <div className="package-columns">
          {packagesInThreeColumns(project.packages).map((columnPackages, col) => (
            <div key={col} className="package-column">
              {columnPackages.map((p) => {
                const isActive = p.id === packageId;
                return (
                  <div
                    key={p.id}
                    className={"choice-tile package-card package-card-block glass" + (isActive ? " is-selected" : "")}
                    style={{
                      textAlign: "left",
                      border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
                      padding: "16px 18px 14px",
                    }}
                  >
                    <div className="package-card-block__head">
                      <div className="package-card-block__title">{p.name}</div>
                    </div>
                    <div className="package-card-block__body">
                      <PackageDescriptionTable description={p.description} />
                    </div>
                    <div className="package-card-block__price">{formatPriceRub(p.priceRub)}</div>
                    <button
                      type="button"
                      className={"package-select-btn" + (isActive ? " is-active" : "")}
                      onClick={() => setPackageId(p.id)}
                      aria-pressed={isActive}
                    >
                      {isActive ? "Выбрано" : "Выбрать"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="flow-section" aria-labelledby="sec-offer">
        <div className="flow-section__head">
          <h2 className="flow-section__title" id="sec-offer">
            <span className="flow-section__step" aria-hidden>
              4
            </span>{" "}
            Получить коммерческое предложение
          </h2>
        </div>

        <div className="co-form-panel" style={{ maxWidth: 520 }}>
          <div className="co-field">
            <label htmlFor="manager">Менеджер</label>
            <select
              id="manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              aria-label="Выбор менеджера"
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fio}
                </option>
              ))}
            </select>
          </div>

          <div className="co-field">
            <label htmlFor="fio">ФИО</label>
            <input
              id="fio"
              value={fio}
              onChange={(e) => setFio(e.target.value)}
              placeholder="Например: Иванов Иван Иванович"
              autoComplete="name"
            />
          </div>

          <div className="co-field">
            <label htmlFor="phone">Номер телефона</label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Например: +7 999 123-45-67"
              autoComplete="tel"
            />
          </div>

          <div className="co-summary">
            <div>
              <b>Планировка:</b> {selectedLayout?.label ?? "—"}
            </div>
            <div>
              <b>Комплектация:</b> {selectedPack?.name ?? "—"}
            </div>
            <div>
              <b>Менеджер:</b> {selectedManager?.fio ?? "—"}
            </div>
          </div>

          {submitError ? <div className="co-err">{submitError}</div> : null}

          <button
            type="button"
            className="co-btn-primary"
            onClick={onDownloadPdf}
            disabled={submitting || !layoutId || !packageId || !managerId}
          >
            {submitting ? "Генерируем PDF…" : "Скачать PDF"}
          </button>

          <p className="co-footnote">
            Документ формируется по выбранной планировке и комплектации. Поля ФИО и телефона проверяются перед
            отправкой.
          </p>
        </div>
      </section>
    </main>
  );
}
