import { Link } from "react-router-dom";
import { RiArrowRightLine, RiPlayFill } from "./ReIcons";

export type ContinueItem = {
  id: string;
  title: string;
  image: string;
  progress: number;
};

const DEFAULT_CONTINUE_ITEMS: ContinueItem[] = [
  {
    id: "skyrealm",
    title: "Skyrealm",
    image: "/images/orbit/continue_skyrealm.png",
    progress: 72,
  },
  {
    id: "drift-nexus",
    title: "Drift Nexus",
    image: "/images/orbit/continue_drift.png",
    progress: 44,
  },
  {
    id: "pixel-craft",
    title: "Pixel Craft",
    image: "/images/orbit/continue_pixel.png",
    progress: 89,
  },
];

export default function ContinuePlayingPanel({
  onSelectGame,
}: {
  onSelectGame?: (item: ContinueItem) => void;
}) {
  return (
    <div className="dashboard-panel continue-playing-panel">
      <div className="panel-header">
        <h2 className="panel-title">Continue Playing</h2>
        <a href="#games" className="panel-header-arrow" aria-label="View all recent games">
          <RiArrowRightLine size={17} />
        </a>
      </div>

      <ul className="cp-items-list">
        {DEFAULT_CONTINUE_ITEMS.map((item) => (
          <li key={item.id} className="cp-item-row">
            <Link
              to={`/game/${item.id}`}
              className="cp-item-link"
              onClick={() => onSelectGame?.(item)}
            >
              <div className="cp-thumb-wrap">
                <img src={item.image} alt={item.title} className="cp-thumb" />
              </div>

              <div className="cp-info">
                <div className="cp-title-row">
                  <span className="cp-game-name">{item.title}</span>
                </div>
                <div className="cp-progress-container">
                  <div className="cp-progress-bar">
                    <div
                      className="cp-progress-fill"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="cp-progress-label">{item.progress}%</span>
                </div>
              </div>

              <div className="cp-play-btn" aria-hidden="true">
                <RiPlayFill size={13} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

