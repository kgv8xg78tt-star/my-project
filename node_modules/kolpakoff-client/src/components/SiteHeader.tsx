import { Link } from "react-router-dom";

type Props = {
  showBack?: boolean;
  eyebrow?: string;
  title?: string;
};

export default function SiteHeader({ showBack, eyebrow, title }: Props) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__edge site-header__edge--left">
          <Link to="/" className="site-header__logo-link" aria-label="На главную">
            <img
              className="site-header__logo"
              src="/files/logo.jpg"
              alt=""
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </Link>
        </div>

        <div className="site-header__center">
          <div className="site-header__titles">
            <span className="site-header__eyebrow">{eyebrow ?? "Коммерческие предложения"}</span>
            {title ? <span className="site-header__title">{title}</span> : null}
          </div>
        </div>

        <div className="site-header__edge site-header__edge--right">
          {showBack ? (
            <Link to="/" className="site-header__back">
              <span className="site-header__back-icon" aria-hidden>
                ←
              </span>
              Все проекты
            </Link>
          ) : (
            <span className="site-header__edge-spacer site-header__edge-spacer--balance" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}
