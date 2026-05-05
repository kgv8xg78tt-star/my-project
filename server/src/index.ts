import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  type ContactData,
  type Manager,
  type Project,
  type ProjectLayout,
  type ProjectPackage,
  getShopData,
} from "./shop/shopData.js";
import { generateCommercialOfferPdf, type CommercialOfferRequest } from "./commercialOffers/generateCommercialOfferPdf.js";

const APP_PORT = Number(process.env.PORT ?? 5177);

// В задании просили использовать E:\\Kolpakoff_shop
const SHOP_ROOT_DIR = process.env.SHOP_ROOT_DIR || "/opt/render/project/src";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// Раздаём файлы из E:\Kolpakoff_shop
// Важно: используем /files/* -> SHOP_ROOT_DIR/*
app.use(
  "/files",
  express.static(SHOP_ROOT_DIR, {
    extensions: [],
  }),
);

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Менеджеры
app.get("/api/managers", (_req, res) => {
  try {
    const { managers } = getShopData({ shopRootDir: SHOP_ROOT_DIR });
    res.json({ managers });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load managers" });
  }
});

// Проекты (список)
app.get("/api/projects", (_req, res) => {
  try {
    const { projects } = getShopData({ shopRootDir: SHOP_ROOT_DIR });
    res.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        renderUrls: p.renderUrls,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load projects" });
  }
});

// Детали проекта
app.get("/api/projects/:projectId", (req, res) => {
  try {
    const projectId = String(req.params.projectId);
    const { projects } = getShopData({ shopRootDir: SHOP_ROOT_DIR });

    const project = projects.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    res.json({ project });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load project" });
  }
});

function requireNonEmpty(v: unknown, fieldName: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`Invalid field "${fieldName}"`);
  }
  return v.trim();
}

function safeParseId(id: string, fieldName: string): string {
  // IDs у нас строки "1", "2"...
  if (!/^\d+$/.test(id)) throw new Error(`Invalid "${fieldName}"`);
  return id;
}

function getById<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error(`${label} not found`);
  return item;
}

// Генерация PDF
app.post("/api/commercial-offers/pdf", async (req, res) => {
  try {
    const body = req.body as Partial<CommercialOfferRequest>;

    const projectId = safeParseId(requireNonEmpty(body.projectId, "projectId"), "projectId");
    const layoutId = safeParseId(requireNonEmpty(body.layoutId, "layoutId"), "layoutId");
    const packageId = safeParseId(requireNonEmpty(body.packageId, "packageId"), "packageId");
    const managerId = safeParseId(requireNonEmpty(body.managerId, "managerId"), "managerId");
    const fio = requireNonEmpty(body.fio, "fio");
    const phone = requireNonEmpty(body.phone, "phone");

    const { managers, projects, contacts } = getShopData({ shopRootDir: SHOP_ROOT_DIR });

    const project = getById(projects, projectId, "Project");
    const layout = getById(project.layouts, layoutId, "Layout");
    const pack = getById(project.packages, packageId, "Package");
    const manager = getById(managers, managerId, "Manager");
    const shopContacts: ContactData = contacts;

    // Парсим request отдельно (меньше шансов ошибиться с типами)
    const request: CommercialOfferRequest = {
      projectId,
      layoutId,
      packageId,
      managerId,
      fio,
      phone,
    };

    const pdfBuffer = await generateCommercialOfferPdf({
      shopConfig: { shopRootDir: SHOP_ROOT_DIR },
      contacts: shopContacts,
      managers,
      project,
      layout,
      pack,
      manager,
      request,
    });

    const filename = `КП_${project.title}_${layout.label}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedFilename}`);
    res.status(200).send(pdfBuffer);
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : "Failed to generate pdf",
    });
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, "../../client/dist");

if (fs.existsSync(path.join(clientDistDir, "index.html"))) {
  app.use(express.static(clientDistDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/files")) return next();
    res.sendFile(path.join(clientDistDir, "index.html"), (err) => next(err));
  });
  // eslint-disable-next-line no-console
  console.log(`[server] SPA static from ${clientDistDir}`);
} else {
  // eslint-disable-next-line no-console
  console.warn(`[server] no client build at ${clientDistDir} (run npm run build in repo root)`);
}

app.listen(APP_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${APP_PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[server] SHOP_ROOT_DIR=${SHOP_ROOT_DIR}`);
});
