import { EventBus } from './eventBus.js';

export function initToolbar() {
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        document.getElementById('themeToggleBtn').innerHTML = isDark ? '☀️' : '🌙';
    });

    document.getElementById('newPageBtn').addEventListener('click', () => EventBus.emit('new-page'));
    document.getElementById('boldBtn').addEventListener('click', () => EventBus.emit('format', 'bold'));
    document.getElementById('alignLeftBtn').addEventListener('click', () => EventBus.emit('format', 'justifyLeft'));
    document.getElementById('alignRightBtn').addEventListener('click', () => EventBus.emit('format', 'justifyRight'));
    document.getElementById('rtlBtn').addEventListener('click', () => EventBus.emit('direction-change', 'rtl'));
    document.getElementById('ltrBtn').addEventListener('click', () => EventBus.emit('direction-change', 'ltr'));
    document.getElementById('redColorBtn').addEventListener('click', () => EventBus.emit('color-change', '#ff0000'));

    document.getElementById('fontSelect').addEventListener('change', (e) => EventBus.emit('font-change', e.target.value));
    document.getElementById('sizeSelect').addEventListener('change', (e) => EventBus.emit('size-change', e.target.value));
    document.getElementById('pageSizeSelect').addEventListener('change', (e) => EventBus.emit('page-size-change', e.target.value));

    document.getElementById('toolbarScaleInput').addEventListener('input', (e) => {
        const val = Math.max(8, parseInt(e.target.value) || 50);
        document.querySelectorAll('.toolbar button, .toolbar select').forEach(el => {
            el.style.fontSize = (val * 0.35) + 'px';
        });
    });
}
