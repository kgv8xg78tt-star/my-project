import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
function formatPriceRub(priceRub) {
    const n = Number.isFinite(priceRub) ? priceRub : 0;
    // Используем обычный пробел, так как Intl.NumberFormat(ru-RU) возвращает узкий неразрывный пробел (\u202F), 
    // которого может не быть в шрифте Roboto, из-за чего появляются "квадратики".
    return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} руб.`;
}
function clampString(s, maxLen) {
    const t = s.trim();
    if (t.length <= maxLen)
        return t;
    return `${t.slice(0, maxLen - 1)}…`;
}
// Перенос строк по реальной ширине текста, с добавлением пунктов (маркеров)
function wrapTextByWidth(text, maxWidth, font, fontSize) {
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rawLines = normalized.split("\n");
    const out = [];
    for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) {
            out.push("");
            continue;
        }
        // Если строка уже начинается с маркера или тире, оставляем, иначе добавляем маркер
        const hasBullet = /^[\u2022\-\*]\s/.test(trimmed);
        const textToProcess = hasBullet ? trimmed : `• ${trimmed}`;
        const words = textToProcess.split(/\s+/).filter(Boolean);
        let current = "";
        for (const w of words) {
            const next = current ? `${current} ${w}` : w;
            const width = font.widthOfTextAtSize(next, fontSize);
            if (width > maxWidth && current) {
                out.push(current);
                // Следующая строка после переноса (можно сделать отступ, но пока просто продолжаем)
                current = `  ${w}`;
            }
            else {
                current = next;
            }
        }
        if (current)
            out.push(current);
    }
    return out;
}
async function getFont(doc, shopRootDir) {
    const fontPath = path.join(shopRootDir, "server", "Roboto-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    return doc.embedFont(fontBytes);
}
function drawTextLines(page, font, opts) {
    const { x, yTop, fontSize, lineHeight, color, lines } = opts;
    const maxLines = opts.maxLines ?? lines.length;
    let y = yTop;
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        page.drawText(lines[i], {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
        });
        y -= lineHeight;
    }
}
export async function generateCommercialOfferPdf(params) {
    const { shopConfig, contacts, project, layout, pack, manager, request } = params;
    const templatePath = path.join(shopConfig.shopRootDir, project.name, // e.g. "Проект Дюна"
    "Пример Коммерческое предложение", `${project.title}.pdf`);
    if (!fs.existsSync(templatePath)) {
        throw new Error(`PDF template not found: ${templatePath}`);
    }
    const logoPath = path.join(shopConfig.shopRootDir, "logo.jpg");
    const logoExists = fs.existsSync(logoPath);
    const templateBytes = fs.readFileSync(templatePath);
    const doc = await PDFDocument.load(templateBytes);
    doc.registerFontkit(fontkit);
    const font = await getFont(doc, shopConfig.shopRootDir);
    const form = doc.getForm();
    // 1. Планировка (Image Button Field)
    try {
        const layoutBtn = form.getButton("Планировка");
        const layoutUrlParts = layout.imageUrl.split("/");
        const layoutFilename = decodeURIComponent(layoutUrlParts[layoutUrlParts.length - 1]);
        const layoutImgPath = path.join(shopConfig.shopRootDir, project.name, "Варианты планировок", layoutFilename);
        if (fs.existsSync(layoutImgPath)) {
            const layoutBytes = fs.readFileSync(layoutImgPath);
            // Всегда конвертируем в PNG через sharp для надёжности
            const pngBuffer = await sharp(layoutBytes).png().toBuffer();
            const embeddedLayout = await doc.embedPng(pngBuffer);
            layoutBtn.setImage(embeddedLayout);
        }
    }
    catch (e) {
        console.error("Не найдено поле Планировка", e);
    }
    // Цветовая гамма: 54-96-139
    const brandR = 54 / 255;
    const brandG = 96 / 255;
    const brandB = 139 / 255;
    const brandColor = rgb(brandR, brandG, brandB);
    // Задачи отрисовки, которые нужно выполнить ПОСЛЕ flatten(), чтобы текст был поверх блоков
    const drawingTasks = [];
    // 2. Комплектация (Красивая таблица)
    try {
        const compField = form.getTextField("Комплектация");
        const widgets = compField.acroField.getWidgets();
        if (widgets.length > 0) {
            const rect = widgets[0].getRectangle();
            const page2 = doc.getPageCount() > 2 ? doc.getPage(2) : doc.getPage(0);
            // Очищаем текст поля, чтобы при flatten() не наложился старый текст
            compField.setText("");
            const maxWidth = rect.width - 40;
            const fontSize = 18;
            const lineHeight = 24;
            const lines = wrapTextByWidth(pack.description, maxWidth, font, fontSize);
            // Рассчитываем необходимую высоту (заголовок + отступы + текст)
            const requiredHeight = lines.length * lineHeight + 100;
            const actualHeight = Math.max(rect.height, requiredHeight);
            const actualY = rect.y + rect.height - actualHeight;
            drawingTasks.push(() => {
                // Рисуем светло-голубой фон
                page2.drawRectangle({
                    x: rect.x,
                    y: actualY,
                    width: rect.width,
                    height: actualHeight,
                    color: rgb(240 / 255, 248 / 255, 255 / 255), // AliceBlue
                });
                // Рисуем бордер
                page2.drawRectangle({
                    x: rect.x,
                    y: actualY,
                    width: rect.width,
                    height: actualHeight,
                    borderColor: brandColor,
                    borderWidth: 2,
                });
                // Заголовок (позиция отсчитывается от верхнего края)
                page2.drawText(`Комплектация: ${pack.name}`, {
                    x: rect.x + 20,
                    y: rect.y + rect.height - 40,
                    size: 26,
                    font,
                    color: brandColor,
                });
                drawTextLines(page2, font, {
                    x: rect.x + 20,
                    yTop: rect.y + rect.height - 80,
                    fontSize,
                    lineHeight: lineHeight,
                    color: { r: brandR, g: brandG, b: brandB },
                    lines,
                });
            });
        }
    }
    catch (e) {
        console.error("Не найдено поле Комплектация", e);
    }
    // Вспомогательная функция для замены поля на свой текст нужного размера
    const replaceFieldWithText = (fieldName, text, pageIndex, fontSize) => {
        try {
            const field = form.getTextField(fieldName);
            const widgets = field.acroField.getWidgets();
            if (widgets.length > 0) {
                const rect = widgets[0].getRectangle();
                const page = doc.getPageCount() > pageIndex ? doc.getPage(pageIndex) : doc.getPage(0);
                const lines = text.split('\n');
                // Очищаем текст поля
                field.setText("");
                drawingTasks.push(() => {
                    // Рисуем текст, отталкиваясь от верхней границы поля (чтобы он точно влезал вниз)
                    drawTextLines(page, font, {
                        x: rect.x,
                        yTop: rect.y + rect.height - fontSize, // начало сверху поля
                        fontSize: fontSize,
                        lineHeight: fontSize * 1.3,
                        color: { r: brandR, g: brandG, b: brandB },
                        lines,
                    });
                });
            }
        }
        catch (e) {
            console.error(`Не найдено поле ${fieldName}`, e);
        }
    };
    // 3. Стоимость (Крупный шрифт, 1 строка)
    replaceFieldWithText("Стоимость", formatPriceRub(pack.priceRub), 3, 34);
    // 4. Менеджер (Несколько строк, чтобы ФИО и телефон влезли)
    replaceFieldWithText("Менеджер", `${manager.fio}\n${manager.phone}`, 3, 20);
    // 5. Заказчик (Несколько строк)
    replaceFieldWithText("Заказчик", `${request.fio}\n${request.phone}`, 3, 20);
    form.updateFieldAppearances(font);
    // Удаляем виджеты полей, чтобы не перекрывали наш кастомный текст
    ['Стоимость', 'Менеджер', 'Заказчик'].forEach(fieldName => {
        try {
            const field = form.getTextField(fieldName);
            const withRemove = field;
            field.acroField.getWidgets().forEach((widget) => {
                withRemove.removeWidget(widget);
            });
        }
        catch (e) {
            console.warn(`Не удалось удалить виджет поля "${fieldName}"`, e);
        }
    });
    // Делаем форму нередактируемой (превращаем в обычный текст/картинки)
    form.flatten();
    // Отрисовываем кастомный текст ПОВЕРХ формы
    for (const task of drawingTasks) {
        task();
    }
    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
}
