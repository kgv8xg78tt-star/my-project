import fs from "node:fs";
import { PDFDocument } from "pdf-lib";

const pdfPath =
  process.env.PDF_PATH ??
  "E:\\Kolpakoff_shop\\Проект Дюна\\Пример Коммерческое предложение\\Дюна.pdf";

const bytes = fs.readFileSync(pdfPath);
const doc = await PDFDocument.load(bytes);

console.log(
  JSON.stringify(
    {
      pdfPath,
      pages: doc.getPageCount(),
      pageSizes: Array.from({ length: doc.getPageCount() }, (_, i) => {
        const p = doc.getPage(i);
        return { i: i + 1, width: p.getWidth(), height: p.getHeight() };
      }),
    },
    null,
    2,
  ),
);
