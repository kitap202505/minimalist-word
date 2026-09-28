import { EditorCore } from './core.js';
import { initToolbar } from './toolbar.js';
import { EventBus } from './eventBus.js';

let ipcRenderer = null;
try {
    ipcRenderer = require('electron').ipcRenderer;
} catch (e) {}

window.addEventListener('DOMContentLoaded', () => {
    const editorContainer = document.getElementById('editorContainer');
    const statsInfo = document.getElementById('statsInfo');
    const saveStatus = document.getElementById('saveStatus');

    const core = new EditorCore(editorContainer);
    initToolbar();

    EventBus.on('stats-updated', (stats) => {
        statsInfo.textContent = `Sayfa ${stats.pages} | ${stats.words} kelime | ${stats.chars} karakter`;
    });

    EventBus.on('content-changed', (html) => {
        saveStatus.textContent = 'Yazılıyor...';
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(() => {
            localStorage.setItem('editorContent', html);
            saveStatus.textContent = 'Kaydedildi';
        }, 800);
    });

    document.getElementById('openBtn').addEventListener('click', () => {
        if (ipcRenderer) {
            ipcRenderer.send('open-file-dialog');
        } else {
            document.getElementById('fileInput').click();
        }
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file && ipcRenderer) {
            saveStatus.textContent = 'Açılıyor...';
            ipcRenderer.send('process-file-path', file.path);
        }
        e.target.value = '';
    });

    const performSave = () => {
        saveStatus.textContent = 'Kaydediliyor...';
        if (ipcRenderer) {
            ipcRenderer.send('save-file', editorContainer.innerHTML);
        }
    };

    document.getElementById('saveBtn').addEventListener('click', performSave);

    EventBus.on('new-page-request', () => {
        const pages = editorContainer.querySelectorAll('.page');
        let hasContent = false;
        pages.forEach(p => {
            if (p.innerText.trim() !== '') hasContent = true;
        });

        if (hasContent) {
            const wantSave = confirm('Mevcut belgenizde kaydedilmemiş içerik olabilir. Kaydetmek ister misiniz?');
            if (wantSave) {
                performSave();
            }
        }
        core.createNewDocument();
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            performSave();
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            if (editorContainer && editorContainer.contains(document.activeElement)) {
                e.preventDefault();
                const pages = editorContainer.querySelectorAll('.page');
                if (pages.length > 0) {
                    const range = document.createRange();
                    range.setStartBefore(pages[0].firstChild || pages[0]);
                    const lastPage = pages[pages.length - 1];
                    range.setEndAfter(lastPage.lastChild || lastPage);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
    });

    if (ipcRenderer) {
        ipcRenderer.on('trigger-save', performSave);
        ipcRenderer.on('save-completed', (event, filePath) => { 
            saveStatus.textContent = '.docx olarak kaydedildi'; 
        });
        ipcRenderer.on('request-save-before-close', () => {
            const pages = editorContainer.querySelectorAll('.page');
            let hasContent = false;
            pages.forEach(p => {
                if (p.innerText.trim() !== '') hasContent = true;
            });

            if (hasContent) {
                const wantSave = confirm('Belgenizi kapatmadan önce .docx olarak kaydetmek ister misiniz?');
                if (wantSave) {
                    performSave();
                }
            }
            ipcRenderer.send('ready-to-close');
        });
        ipcRenderer.on('load-file-success', (event, data) => {
            EventBus.emit('load-html', data.html);
            saveStatus.textContent = 'Açıldı: ' + data.fileName;
        });
        ipcRenderer.on('load-file-error', (event, msg) => {
            alert(msg);
            saveStatus.textContent = 'Hata';
        });
    }
});
