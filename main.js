const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const HTMLtoDOCX = require('html-to-docx');

let mainWindow;
let currentFilePath = null;
let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.webContents.send('request-save-before-close');
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('ready-to-close', () => {
    isQuitting = true;
    app.quit();
});

ipcMain.on('open-file-dialog', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        filters: [
            { name: 'Word Belgeleri & Metin', extensions: ['docx', 'html', 'htm', 'txt'] }
        ],
        properties: ['openFile']
    });

    if (!canceled && filePaths.length > 0) {
        processFilePath(filePaths[0], event.sender);
    }
});

ipcMain.on('process-file-path', (event, filePath) => {
    processFilePath(filePath, event.sender);
});

async function processFilePath(filePath, sender) {
    try {
        currentFilePath = filePath;
        const ext = path.extname(filePath).toLowerCase();
        let htmlContent = '';
        const fileName = path.basename(filePath);

        if (ext === '.docx') {
            const result = await mammoth.convertToHtml({ path: filePath });
            htmlContent = result.value;
        } else {
            htmlContent = fs.readFileSync(filePath, 'utf8');
        }

        sender.send('load-file-success', { html: htmlContent, fileName });
    } catch (error) {
        sender.send('load-file-error', 'Dosya okunurken hata oluştu: ' + error.message);
    }
}

ipcMain.on('save-file', async (event, htmlContent) => {
    try {
        let filePath = currentFilePath;
        if (!filePath) {
            const { canceled, filePath: savedPath } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: 'Belge.docx',
                filters: [
                    { name: 'Word Belgesi (.docx)', extensions: ['docx'] },
                    { name: 'HTML Dosyası', extensions: ['html'] },
                    { name: 'Metin Belgesi', extensions: ['txt'] }
                ]
            });
            if (canceled || !savedPath) {
                event.sender.send('save-cancelled');
                return;
            }
            filePath = savedPath;
            currentFilePath = filePath;
        }

        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.docx' || !ext) {
            if (!filePath.endsWith('.docx')) filePath += '.docx';
            const buffer = await HTMLtoDOCX(htmlContent, null, {
                table: { row: { cantSplit: true } }
            });
            fs.writeFileSync(filePath, buffer);
        } else if (ext === '.txt') {
            const plainText = htmlContent.replace(/<[^>]*>/g, '');
            fs.writeFileSync(filePath, plainText, 'utf8');
        } else {
            fs.writeFileSync(filePath, htmlContent, 'utf8');
        }

        event.sender.send('save-completed', filePath);
    } catch (error) {
        console.error('Kaydetme hatası:', error);
    }
});
