// parser.js — PDF.js + Tesseract.js text extraction. Only this file uses those libraries.

/**
 * extractTextFromFile(file, onProgress)
 * Extracts text from a PDF or .txt file.
 * onProgress(percent, message) for UI updates.
 * Returns Promise<string>
 */
export async function extractTextFromFile(file, onProgress) {
  const update = (pct, msg) => { if (onProgress) onProgress(pct, msg); };

  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    update(10, 'Reading text file...');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        update(100, 'Text file loaded.');
        resolve(e.target.result);
      };
      reader.onerror = () => reject(new Error('Failed to read text file.'));
      reader.readAsText(file);
    });
  }

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    update(5, 'Loading PDF...');
    return extractTextFromPDF(file, onProgress);
  }

  throw new Error('Unsupported file type. Please upload a .pdf or .txt file.');
}

// Group PDF text items by Y position to reconstruct proper lines.
// Each item has transform[5] = Y coordinate on the page.
function reconstructLines(items) {
  if (!items || items.length === 0) return '';

  // Sort by descending Y (top of page first), then ascending X
  const sorted = items
    .filter(item => item.str && item.str.trim())
    .map(item => ({
      str: item.str,
      x: item.transform[4],
      y: Math.round(item.transform[5]), // round to group near-same-Y items
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  let currentY = null;
  let currentLine = [];

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) > 3) {
      if (currentLine.length > 0) lines.push(currentLine.join(' ').trim());
      currentLine = [item.str];
      currentY = item.y;
    } else {
      currentLine.push(item.str);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine.join(' ').trim());

  return lines.join('\n');
}

async function extractTextFromPDF(file, onProgress) {
  const update = (pct, msg) => { if (onProgress) onProgress(pct, msg); };

  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF.js library not loaded.');

  // Set worker
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  update(10, 'Parsing PDF structure...');

  let pdfDoc;
  try {
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (e) {
    throw new Error(`PDF parsing failed: ${e.message}`);
  }

  const numPages = pdfDoc.numPages;
  let fullText = '';
  let hasTextLayer = false;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pct = 10 + Math.round((pageNum / numPages) * 70);
    update(pct, `Extracting text from page ${pageNum} of ${numPages}...`);

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = reconstructLines(textContent.items);

    if (pageText.trim().length > 20) {
      hasTextLayer = true;
      fullText += pageText + '\n';
    }
  }

  if (hasTextLayer && fullText.trim().length > 50) {
    update(100, 'PDF text extracted successfully.');
    return fullText;
  }

  // Fallback: OCR with Tesseract
  update(80, 'No text layer found. Starting OCR fallback...');
  return extractTextWithOCR(file, onProgress);
}

async function extractTextWithOCR(file, onProgress) {
  const update = (pct, msg) => { if (onProgress) onProgress(pct, msg); };

  const Tesseract = window.Tesseract;
  if (!Tesseract) throw new Error('Tesseract.js OCR library not loaded.');

  update(82, 'Initializing OCR engine...');

  return new Promise((resolve, reject) => {
    Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = 82 + Math.round(m.progress * 15);
          update(pct, `OCR in progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    })
      .then(({ data: { text } }) => {
        update(100, 'OCR complete.');
        resolve(text);
      })
      .catch(err => reject(new Error(`OCR failed: ${err.message}`)));
  });
}
