import fs from "node:fs";
import path from "node:path";
function ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath))
        throw new Error(`Directory not found: ${dirPath}`);
}
function listDirectories(dirPath) {
    ensureDirExists(dirPath);
    return fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
}
function readTextFile(filePath) {
    return fs.readFileSync(filePath, { encoding: "utf8" });
}
export function parseManagers(shopRootDir) {
    const managersFile = path.join(shopRootDir, "Менеджеры.txt");
    const raw = readTextFile(managersFile);
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    const result = [];
    for (const line of lines) {
        const match = line.match(/^(.*)\s+(\+?\d[\d\s()-]+)$/);
        if (!match)
            continue;
        const fio = match[1].trim();
        const phone = match[2].trim();
        result.push({ id: String(result.length + 1), fio, phone });
    }
    return result;
}
function parsePriceRub(line) {
    const match = line.match(/Цена:\s*([\d.\s]+)\s*руб/i);
    if (!match)
        return null;
    const rawNum = match[1].replace(/\s+/g, "").replace(/\./g, "");
    const n = Number(rawNum);
    return Number.isFinite(n) ? n : null;
}
function parsePackageFileContent(text) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    let priceRub = null;
    const descLines = [];
    for (const l of lines) {
        if (/^Цена:/i.test(l)) {
            priceRub = parsePriceRub(l);
            continue;
        }
        descLines.push(l);
    }
    return {
        name: "",
        description: descLines.join("\n"),
        priceRub: priceRub ?? 0,
    };
}
function projectTitleFromFolderName(folderName) {
    return folderName.replace(/^Проект\s+/u, "");
}
function shopUrlForFile(projectFolderName, relativePathFromProject) {
    // relativePathFromProject example: "Рендеры/Сцена 1.png"
    // Мы раздаем /files/<folder>/<pathInside> как статик из SHOP_ROOT_DIR
    return `/files/${encodeURIComponent(projectFolderName)}/${relativePathFromProject
        .split(/[/\\]/g)
        .map((p) => encodeURIComponent(p))
        .join("/")}`;
}
export function parseProject(shopRootDir, projectFolderName) {
    const projectDir = path.join(shopRootDir, projectFolderName);
    const title = projectTitleFromFolderName(projectFolderName);
    const renderDir = path.join(projectDir, "Рендеры");
    const layoutsDir = path.join(projectDir, "Варианты планировок");
    const packagesDir = path.join(projectDir, "Описание комплектаций");
    ensureDirExists(renderDir);
    ensureDirExists(layoutsDir);
    ensureDirExists(packagesDir);
    const renderFiles = fs
        .readdirSync(renderDir)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
    const renderUrls = renderFiles.map((f) => shopUrlForFile(projectFolderName, `Рендеры/${f}`));
    const layoutFiles = fs
        .readdirSync(layoutsDir)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
    const layouts = layoutFiles.map((file, idx) => {
        const id = String(idx + 1);
        const label = file
            .replace(/\.(png|jpg|jpeg|webp)$/i, "")
            .replace(/\.webp$/i, "");
        return {
            id,
            label,
            imageUrl: shopUrlForFile(projectFolderName, `Варианты планировок/${file}`),
        };
    });
    const packageFiles = fs
        .readdirSync(packagesDir)
        .filter((f) => /\.txt$/i.test(f));
    const packages = packageFiles.map((file, idx) => {
        const packageName = file.replace(/\.txt$/i, "");
        const text = readTextFile(path.join(packagesDir, file));
        const parsed = parsePackageFileContent(text);
        return {
            id: String(idx + 1),
            name: packageName,
            description: parsed.description,
            priceRub: parsed.priceRub,
        };
    });
    return {
        id: "",
        name: projectFolderName,
        title,
        renderUrls,
        layouts,
        packages,
    };
}
export function parseContacts(shopRootDir) {
    const filePath = path.join(shopRootDir, "Контактные данные.txt");
    const raw = readTextFile(filePath);
    const getLineValue = (label) => {
        const re = new RegExp(`^${label}\\s*(.*)$`, "im");
        const m = raw.match(re);
        return (m?.[1] ?? "").trim();
    };
    // Адрес: многострочный, после "Адрес офиса:" до пустой строки
    const addressMatch = raw.match(/Адрес офиса:\s*([\s\S]*?)\n\s*\n/imu) ?? raw.match(/Адрес офиса:\s*([\s\S]*)/imu);
    const address = (addressMatch?.[1] ?? "").trim();
    return {
        address,
        phone: getLineValue("Телефон:"),
        email: getLineValue("Email:"),
        site: getLineValue("Сайт:"),
    };
}
export function computeProjects(shopRootDir) {
    const folderNames = listDirectories(shopRootDir)
        .filter((n) => n.startsWith("Проект "))
        .sort((a, b) => a.localeCompare(b, "ru"));
    return folderNames.map((folderName, idx) => {
        const p = parseProject(shopRootDir, folderName);
        return { ...p, id: String(idx + 1) };
    });
}
export function getShopData(config) {
    const managers = parseManagers(config.shopRootDir);
    const projects = computeProjects(config.shopRootDir);
    const contacts = parseContacts(config.shopRootDir);
    return { managers, projects, contacts };
}
