import { Badge, Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular, Open24Regular, VideoClip24Regular } from "@fluentui/react-icons";
import { creatorHostname } from "../lib/format";

import type { WorkstationStore } from "../useWorkstationStore";

export function StudioView({ store }: { store: WorkstationStore }) {
  const { setLinkDialogOpen, creatorLinks, moveCreatorLink, deleteCreatorLink } = store;
    return (
      <section className="page-section studio-page">
        <div className="page-heading">
          <div>
            <p className="date-label">创作发布</p>
            <h1>从一个地方进入所有发布后台。</h1>
            <p>默认入口使用平台官方地址；你可以继续添加自己的后台或常用工具。</p>
          </div>
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={() => setLinkDialogOpen(true)}
          >
            添加入口
          </Button>
        </div>

        <MessageBar intent="info">
          <MessageBarBody>
            前三个入口会显示在工作台首页。调整顺序即可设置你的常用平台；登录状态和发布权限仍由各平台管理。
          </MessageBarBody>
        </MessageBar>

        <div className="creator-link-grid">
          {creatorLinks.map((link, index) => (
            <article className="creator-link-card" key={link.id}>
              <div className="creator-link-top">
                <span className="creator-link-icon" aria-hidden="true">
                  <VideoClip24Regular />
                </span>
                <Badge appearance="tint">
                  {link.builtIn ? "预置入口" : "自定义"}
                </Badge>
              </div>
              <div>
                <h2>{link.name}</h2>
                <p>{link.description}</p>
                <code>{creatorHostname(link.url)}</code>
              </div>
              <div className="creator-link-actions">
                <a href={link.url} target="_blank" rel="noreferrer">
                  打开后台 <Open24Regular aria-hidden="true" />
                </a>
                <div className="creator-order-actions">
                  <Button
                    appearance="subtle"
                    size="small"
                    disabled={index === 0}
                    onClick={() => moveCreatorLink(link.id, -1)}
                  >
                    上移
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    disabled={index === creatorLinks.length - 1}
                    onClick={() => moveCreatorLink(link.id, 1)}
                  >
                    下移
                  </Button>
                  {!link.builtIn ? (
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Delete24Regular />}
                      onClick={() => deleteCreatorLink(link.id)}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    );}
