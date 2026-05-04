import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const pdfPath =
  process.env.PDF_PATH ??
  "E:\\Kolpakoff_shop\\Проект Дюна\\Пример Коммерческое предложение\\Дюна.pdf";

const bytes = fs.readFileSync(pdfPath);
const doc = await PDFDocument.load(bytes);

const form = doc.getForm();
const fields = form.getFields();

console.log(
  JSON.stringify(
    {
      pdfPath,
      pages: doc.getPageCount(),
      hasForm: !!form,
      fields: fields.map((f) => ({
        type: f.constructor?.name,
        name: f.getName(),
      })),
    },
    null,
    2,
  ),
);
