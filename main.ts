import { Plugin, ItemView, WorkspaceLeaf, TFolder, TFile, setIcon, Menu, TAbstractFile, PluginSettingTab, Setting } from 'obsidian';
// @ts-ignore
const Sortable = require('sortablejs'); 

// 保持 v29 的 ID 不变，确保你的工作区缓存能认出它
const VIEW_TYPE_CUSTOM_SORT = 'custom-sort-view-v29-visual-tweaks';

// 默认配置
interface CustomSortSettings {
    order: Record<string, string[]>;
    collapsedState: string[];
    rowPadding: number;      
    indentation: number;     
    rainbowColors: string[]; 
}

const DEFAULT_SETTINGS: CustomSortSettings = {
    order: {},
    collapsedState: [],
    rowPadding: 2,
    indentation: 9, 
    rainbowColors: [
        '#ff7875', '#ff9c6e', '#fadb14', '#95de64', 
        '#5cdbd3', '#69c0ff', '#b37feb', '#ff85c0'
    ]
}

// --- 设置页类 ---
class CustomSortSettingTab extends PluginSettingTab {
    plugin: CustomSortPlugin;

    constructor(app: any, plugin: CustomSortPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: '自定义排序插件设置'});

        new Setting(containerEl)
            .setName('文件行高 (Padding)')
            .setDesc('调整每一行文件/文件夹的上下间距。')
            .addSlider(slider => slider
                .setLimits(0, 10, 1)
                .setValue(this.plugin.settings.rowPadding)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.rowPadding = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshAllViews(); 
                }));

        new Setting(containerEl)
            .setName('内容缩进 (Content Padding)')
            .setDesc('调整竖线右侧内容（文件名）的距离。竖线位置保持不变。')
            .addSlider(slider => slider
                .setLimits(5, 50, 1)
                .setValue(this.plugin.settings.indentation)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.indentation = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshAllViews();
                }));

        containerEl.createEl('h3', {text: '彩虹卡片配色 (循环使用)'});
        
        const colorContainer = containerEl.createDiv();
        colorContainer.style.display = 'flex';
        colorContainer.style.flexWrap = 'wrap';
        colorContainer.style.gap = '10px';

        this.plugin.settings.rainbowColors.forEach((color, index) => {
            new Setting(colorContainer)
                .setName(`颜色 ${index + 1}`)
                .addColorPicker(colorPicker => colorPicker
                    .setValue(color)
                    .onChange(async (value) => {
                        this.plugin.settings.rainbowColors[index] = value;
                        await this.plugin.saveSettings();
                        this.plugin.refreshAllViews();
                    }));
        });
        
        new Setting(containerEl)
            .setName('重置颜色')
            .setDesc('恢复默认的彩虹配色。')
            .addButton(btn => btn
                .setButtonText('重置')
                .onClick(async () => {
                    this.plugin.settings.rainbowColors = [...DEFAULT_SETTINGS.rainbowColors];
                    await this.plugin.saveSettings();
                    this.plugin.refreshAllViews();
                    this.display(); 
                }));
    }
}

class CustomSortView extends ItemView {
    plugin: CustomSortPlugin;
    activeFilePath: string | null = null; 

    constructor(leaf: WorkspaceLeaf, plugin: CustomSortPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() { return VIEW_TYPE_CUSTOM_SORT; }
    getDisplayText() { return "自定义排序"; }
    getIcon() { return "folder"; }

    async onOpen() {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.activeFilePath = activeFile.path;
        }
        this.refresh();
    }

    async revealItem(item: TAbstractFile) {
        if (!item) return;
        this.activeFilePath = item.path;
        
        let parent = item.parent;
        let changed = false;
        while (parent && !parent.isRoot()) {
            if (this.plugin.settings.collapsedState.includes(parent.path)) {
                this.plugin.settings.collapsedState.remove(parent.path);
                changed = true;
            }
            parent = parent.parent;
        }

        if (changed) await this.plugin.saveSettings();

        this.refresh();

        setTimeout(() => {
            let targetEl: HTMLElement | null = null;
            if (item instanceof TFile) {
                targetEl = this.containerEl.querySelector(`.my-custom-row[data-file-path="${item.path}"]`);
            } else {
                const rows = Array.from(this.containerEl.querySelectorAll('.my-custom-row'));
                targetEl = rows.find(el => el.getAttribute('data-folder-path') === item.path) as HTMLElement;
            }

            if (targetEl) {
                this.containerEl.querySelectorAll('.is-active').forEach(el => el.removeClass('is-active'));
                targetEl.addClass('is-active');
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 200);
    }

    refresh() {
        if (!this.containerEl || !this.containerEl.children[1]) return;
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('nav-files-container');
        
        const rowPadding = this.plugin.settings.rowPadding;
        const indent = this.plugin.settings.indentation;
        
        const style = document.createElement('style');
        style.textContent = `
            .my-top-toolbar {
                display: flex; align-items: center; justify-content: center;
                gap: 16px; padding: 6px 8px; margin-bottom: 8px;
                border-bottom: 1px solid var(--background-modifier-border);
                background-color: var(--background-primary);
            }
            .my-toolbar-btn {
                display: flex; align-items: center; justify-content: center;
                width: 32px; height: 28px; border-radius: 4px;
                color: var(--text-muted); cursor: pointer; transition: all 0.1s;
            }
            .my-toolbar-btn:hover { background-color: var(--background-modifier-hover); color: var(--text-normal); }
            
            .my-custom-row {
                display: flex !important; align-items: center !important; cursor: pointer;
                border-radius: 4px; margin-bottom: 1px;
                transition: background-color 0.1s; position: relative;
                padding-right: 4px;
                padding-top: ${rowPadding}px;
                padding-bottom: ${rowPadding}px;
            }
            .my-custom-row:hover { background-color: var(--nav-item-background-hover); }
            
            .my-custom-row.is-active {
                background-color: var(--nav-item-background-active) !important;
                color: var(--text-on-accent);
            }
            .my-custom-row.is-active .my-folder-text,
            .my-custom-row.is-active .my-file-text,
            .my-custom-row.is-active .my-icon-box {
                color: var(--text-normal) !important;
            }

            .my-folder-text { font-weight: 700; color: var(--text-normal); }
            .my-file-text { font-weight: 400; color: var(--text-normal); }

            .my-custom-row:hover + .my-children-container {
                background-color: rgba(var(--mono-rgb-100), 0.08); border-radius: 4px;
            }

            .my-root-card {
                margin-bottom: 8px; background-color: transparent; 
                border-radius: 6px 0 0 6px; 
                position: relative; overflow: visible; transition: z-index 0s;
                border-top: 1px solid var(--this-folder-color);
                border-bottom: 1px solid var(--this-folder-color);
                border-left: none; border-right: none; 
            }
            .my-root-card:hover { z-index: 100; }

            .my-root-card::before {
                content: ''; position: absolute; left: 0; 
                top: -1px; bottom: 0; 
                width: 4px;
                background-color: var(--this-folder-color); 
                z-index: 10; border-top-left-radius: 4px; border-bottom-left-radius: 4px;
            }
            
            .my-root-card-header {
                background-color: var(--background-secondary);
                padding: 6px 12px 6px 16px !important; 
                border-bottom: 1px solid var(--background-modifier-border);
                position: relative; z-index: 2; 
            }

            .my-children-container {
                margin-left: 11px; 
                padding-left: ${indent}px; 
                border-left: 2px solid var(--nav-indentation-guide-color);
                transition: border-color 0.2s; min-height: 10px;
            }
            .my-root-children-container {
                border-left: none !important; margin-left: 0 !important; padding-left: 12px !important; 
            }

            .my-icon-box {
                display: flex; align-items: center; justify-content: center;
                width: 24px; height: 24px; flex-shrink: 0; margin-right: 2px; 
            }
            .my-root-card .my-type-icon { color: var(--this-folder-color) !important; }
            .my-type-icon { color: var(--text-accent); }
            
            .my-title-text {
                flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .my-file-badge {
                font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 3px;
                margin-left: auto; margin-right: 6px; color: rgba(255,255,255, 0.95);
            }

            .my-action-group { display: none; align-items: center; gap: 2px; }
            .my-custom-row:hover .my-action-group { display: flex; }

            .my-action-btn {
                display: flex; align-items: center; justify-content: center;
                width: 20px; height: 20px; border-radius: 3px;
                color: var(--text-muted); opacity: 0.7; position: relative;
            }
            .my-action-btn:hover { background-color: var(--background-modifier-hover); opacity: 1; color: var(--text-normal); }

            .my-hover-menu {
                display: none; position: absolute; top: 100%; right: 0;
                background-color: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                border-radius: 4px; padding: 4px; z-index: 9999; 
                width: 120px; flex-direction: column; gap: 2px;
            }
            .my-action-btn:hover .my-hover-menu, .my-hover-menu:hover { display: flex; }
            
            .my-menu-item {
                display: flex; align-items: center; padding: 4px 8px;
                font-size: 12px; border-radius: 4px; color: var(--text-normal); cursor: pointer;
            }
            .my-menu-item:hover { background-color: var(--interactive-accent); color: var(--text-on-accent); }
            .my-menu-icon { margin-right: 6px; width: 14px; height: 14px; }
        `;
        container.appendChild(style);

        const toolbar = container.createDiv('my-top-toolbar');
        
        const newFileBtn = toolbar.createDiv('my-toolbar-btn');
        setIcon(newFileBtn, 'file-plus');
        newFileBtn.onclick = () => this.createNewItem(this.app.vault.getRoot(), 'md');

        const newFolderBtn = toolbar.createDiv('my-toolbar-btn');
        setIcon(newFolderBtn, 'folder-plus');
        newFolderBtn.onclick = () => this.createNewItem(this.app.vault.getRoot(), 'folder');

        const collapseAllBtn = toolbar.createDiv('my-toolbar-btn');
        const rootChildren = this.app.vault.getRoot().children;
        let anyExpanded = false;
        for (const child of rootChildren) {
            if (child instanceof TFolder && !this.plugin.settings.collapsedState.includes(child.path)) {
                anyExpanded = true;
                break;
            }
        }
        const toggleIcon = anyExpanded ? 'chevrons-up' : 'chevrons-down';
        setIcon(collapseAllBtn, toggleIcon);

        collapseAllBtn.onclick = async () => {
            let changed = false;
            if (anyExpanded) {
                for (const child of rootChildren) {
                    if (child instanceof TFolder && !this.plugin.settings.collapsedState.includes(child.path)) {
                        this.plugin.settings.collapsedState.push(child.path);
                        changed = true;
                    }
                }
            } else {
                for (const child of rootChildren) {
                    if (child instanceof TFolder) {
                        this.plugin.settings.collapsedState.remove(child.path);
                        changed = true;
                    }
                }
            }
            if (changed) {
                await this.plugin.saveSettings();
                this.refresh();
            }
        };

        const rootFolder = this.app.vault.getRoot();
        this.renderFolder(container, rootFolder, 0, 0);
    }

    renderFolder(parentEl: HTMLElement, folder: TFolder, depth: number, rootIndex: number) {
        let childrenContainer = parentEl;

        if (!folder.isRoot()) {
            const folderEl = parentEl.createDiv('nav-folder');
            
            if (depth === 1) {
                const colors = this.plugin.settings.rainbowColors;
                const color = colors[rootIndex % colors.length];
                folderEl.style.setProperty('--this-folder-color', color);
                folderEl.addClass('my-root-card');
            }

            const titleEl = folderEl.createDiv('my-custom-row');
            titleEl.setAttribute('data-folder-path', folder.path); 

            if (depth === 1) titleEl.addClass('my-root-card-header');
            if (depth > 1) titleEl.style.paddingLeft = '0px'; 

            const iconEl = titleEl.createDiv('my-icon-box my-type-icon');
            const textEl = titleEl.createDiv('my-title-text my-folder-text'); 
            textEl.setText(folder.name);

            if (this.activeFilePath === folder.path) titleEl.addClass('is-active');

            const actionGroup = titleEl.createDiv('my-action-group');

            const collapseBtn = actionGroup.createDiv('my-action-btn');
            let hasExpandedChild = false;
            let hasChildFolder = false;
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    hasChildFolder = true;
                    if (!this.plugin.settings.collapsedState.includes(child.path)) {
                        hasExpandedChild = true;
                        break;
                    }
                }
            }

            if (hasChildFolder) {
                setIcon(collapseBtn, hasExpandedChild ? 'chevrons-up' : 'chevrons-down');
                collapseBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    let changed = false;
                    const children = folder.children;
                    if (hasExpandedChild) {
                        for (const child of children) {
                            if (child instanceof TFolder && !this.plugin.settings.collapsedState.includes(child.path)) {
                                this.plugin.settings.collapsedState.push(child.path);
                                changed = true;
                            }
                        }
                    } else {
                        for (const child of children) {
                            if (child instanceof TFolder) {
                                this.plugin.settings.collapsedState.remove(child.path);
                                changed = true;
                            }
                        }
                    }
                    if (changed) {
                        await this.plugin.saveSettings();
                        this.refresh(); 
                    }
                });
            } else {
                collapseBtn.style.display = 'none';
            }

            const plusBtn = actionGroup.createDiv('my-action-btn');
            setIcon(plusBtn, 'plus');
            plusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.createNewItem(folder, 'md');
            });

            const menuContainer = plusBtn.createDiv('my-hover-menu');
            this.createMenuItem(menuContainer, 'file-plus', '新建笔记', () => this.createNewItem(folder, 'md'));
            this.createMenuItem(menuContainer, 'folder-plus', '新建文件夹', () => this.createNewItem(folder, 'folder'));
            this.createMenuItem(menuContainer, 'layout-dashboard', '新建白板', () => this.createNewItem(folder, 'canvas'));

            this.addNativeContextMenu(titleEl, folder);

            childrenContainer = folderEl.createDiv('my-children-container');
            childrenContainer.setAttribute('data-folder-path', folder.path);
            if (depth === 1) childrenContainer.addClass('my-root-children-container');

            const isInitiallyCollapsed = this.plugin.settings.collapsedState.includes(folder.path);
            if (isInitiallyCollapsed) {
                folderEl.addClass('is-collapsed');
                childrenContainer.style.display = 'none';
                setIcon(iconEl, 'lucide-folder');
            } else {
                folderEl.classList.remove('is-collapsed');
                childrenContainer.style.display = 'block';
                setIcon(iconEl, 'lucide-folder-open');
            }

            titleEl.addEventListener('click', async (e) => {
                e.stopPropagation();
                const isCollapsed = folderEl.classList.contains('is-collapsed');
                iconEl.empty();
                if (isCollapsed) {
                    folderEl.classList.remove('is-collapsed');
                    childrenContainer.style.display = 'block';
                    setIcon(iconEl, 'lucide-folder-open');
                    this.plugin.settings.collapsedState.remove(folder.path);
                } else {
                    folderEl.classList.add('is-collapsed');
                    childrenContainer.style.display = 'none';
                    setIcon(iconEl, 'lucide-folder');
                    if (!this.plugin.settings.collapsedState.includes(folder.path)) {
                        this.plugin.settings.collapsedState.push(folder.path);
                    }
                }
                await this.plugin.saveSettings();
            });
        } else {
            childrenContainer.setAttribute('data-folder-path', '/');
        }

        let items = folder.children;
        const savedOrder = this.plugin.settings.order[folder.path];
        if (savedOrder) {
            items = items.slice().sort((a, b) => {
                const indexA = savedOrder.indexOf(a.name);
                const indexB = savedOrder.indexOf(b.name);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.name.localeCompare(b.name);
            });
        }

        let currentRootIndex = rootIndex;

        for (const child of items) {
            const itemWrapper = childrenContainer.createDiv();
            itemWrapper.setAttribute('data-name', child.name);
            itemWrapper.setAttribute('data-file-path', child.path);

            const nextDepth = folder.isRoot() ? 1 : depth + 1;
            let childRootIndex = currentRootIndex;
            if (depth === 0 && child instanceof TFolder) {
                childRootIndex = currentRootIndex++;
            }

            if (child instanceof TFile) {
                const fileRow = itemWrapper.createDiv('my-custom-row');
                fileRow.setAttribute('data-file-path', child.path); 

                if (this.activeFilePath === child.path) {
                    fileRow.addClass('is-active');
                }

                const iconEl = fileRow.createDiv('my-icon-box my-type-icon');
                const iconName = this.getFileIcon(child.extension); 
                setIcon(iconEl, iconName);

                const textEl = fileRow.createDiv('my-title-text my-file-text'); 
                textEl.setText(child.basename);

                if (child.extension !== 'md') {
                    const badgeInfo = this.getFileBadgeInfo(child.extension);
                    const badgeEl = fileRow.createDiv('my-file-badge');
                    badgeEl.setText(badgeInfo.text);
                    badgeEl.style.backgroundColor = badgeInfo.color;
                }

                this.addNativeContextMenu(fileRow, child);

                fileRow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // --- 核心修改：使用 getLeaf(false) 确保不在侧边栏打开 ---
                    this.app.workspace.getLeaf(false).openFile(child);
                });
            } else if (child instanceof TFolder) {
                this.renderFolder(itemWrapper, child, nextDepth, childRootIndex);
            }
        }

        Sortable.create(childrenContainer, {
            group: 'obsidian-sort',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async (evt: any) => {
                const itemEl = evt.item;
                const newParentEl = evt.to;   
                const oldParentEl = evt.from; 
                const targetFolderPath = newParentEl.getAttribute('data-folder-path');
                if (!targetFolderPath) return;

                const newOrder: string[] = [];
                const itemEls = newParentEl.children;
                for (let i = 0; i < itemEls.length; i++) {
                    const el = itemEls[i] as HTMLElement;
                    const name = el.getAttribute('data-name');
                    if (name) newOrder.push(name);
                }

                this.plugin.settings.order[targetFolderPath] = newOrder;
                
                if (newParentEl !== oldParentEl) {
                    const oldFolderPath = oldParentEl.getAttribute('data-folder-path');
                    if (oldFolderPath) {
                         const oldOrder: string[] = [];
                         const oldItemEls = oldParentEl.children;
                         for (let i = 0; i < oldItemEls.length; i++) {
                            const el = oldItemEls[i] as HTMLElement;
                            const name = el.getAttribute('data-name');
                            if (name) oldOrder.push(name);
                         }
                         this.plugin.settings.order[oldFolderPath] = oldOrder;
                    }
                }
                
                await this.plugin.saveSettings();

                if (newParentEl !== oldParentEl) {
                    const filePath = itemEl.getAttribute('data-file-path');
                    if (filePath) {
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        const targetPathStr = targetFolderPath === '/' ? '' : targetFolderPath;
                        let targetFolder = this.app.vault.getAbstractFileByPath(targetPathStr || '/');
                        
                        if (file && targetFolder instanceof TFolder) {
                            const newPath = (targetFolder.isRoot() ? "" : targetFolder.path + "/") + file.name;
                            await this.app.fileManager.renameFile(file, newPath);
                        }
                    }
                }
                this.plugin.refreshAllViews();
            }
        });
    }

    createMenuItem(container: HTMLElement, icon: string, text: string, callback: () => void) {
        const item = container.createDiv('my-menu-item');
        const iconEl = item.createDiv('my-menu-icon');
        setIcon(iconEl, `lucide-${icon}`);
        item.createSpan({ text: text });
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            callback();
        });
    }

    addNativeContextMenu(el: HTMLElement, file: TAbstractFile) {
        el.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            const menu = new Menu();
            this.app.workspace.trigger('file-menu', menu, file, 'file-explorer');
            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle(file instanceof TFolder ? "重命名文件夹" : "重命名").setIcon("lucide-pencil")
                    .onClick(() => { 
                        // @ts-ignore
                        this.app.fileManager.promptForFileRename(file); 
                    });
            });
            menu.addItem((item) => {
                item.setTitle(file instanceof TFolder ? "删除文件夹" : "删除").setIcon("lucide-trash")
                    .onClick(() => { 
                        // @ts-ignore
                        this.app.fileManager.promptForFileDeletion(file); 
                    });
            });
            menu.showAtPosition({ x: event.pageX, y: event.pageY });
        });
    }

    async createNewItem(folder: TFolder, type: 'md' | 'folder' | 'canvas') {
        const basePath = folder.isRoot() ? "" : folder.path + "/";
        const timestamp = Date.now();
        try {
            let newFile: TAbstractFile;
            if (type === 'md') {
                newFile = await this.app.vault.create(basePath + "未命名笔记 " + timestamp + ".md", "");
                this.app.workspace.getLeaf(false).openFile(newFile as TFile);
            } else if (type === 'folder') {
                newFile = await this.app.vault.createFolder(basePath + "未命名文件夹 " + timestamp);
            } else {
                newFile = await this.app.vault.create(basePath + "未命名白板 " + timestamp + ".canvas", "{\"nodes\":[],\"edges\":[]}");
                this.app.workspace.getLeaf(false).openFile(newFile as TFile);
            }
            
            setTimeout(() => { 
                // @ts-ignore
                this.app.fileManager.promptForFileRename(newFile); 
                this.revealItem(newFile);
            }, 300);
        } catch (e) {}
    }

    getFileIcon(extension: string): string {
        switch (extension.toLowerCase()) {
            case 'pdf': return 'pdf-file';
            case 'png': case 'jpg': case 'jpeg': case 'svg': return 'image-file';
            default: return 'document';
        }
    }

    getFileBadgeInfo(extension: string): { text: string, color: string } {
        const ext = extension.toUpperCase();
        switch (extension.toLowerCase()) {
            // PDF: 柔和青
            case 'pdf': return { text: 'PDF', color: '#4b8585' };
            
            // 图片: 雾霾紫
            case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': 
                return { text: 'IMG', color: '#7d6a96' };
            
            // Word: 钢蓝
            case 'doc': case 'docx': 
                return { text: 'DOC', color: '#5b7db1' };
            
            // PPT: 砖红 (降低了攻击性)
            case 'ppt': case 'pptx': 
                return { text: 'PPT', color: '#c26565' };
            
            // Excel: 鼠尾草绿
            case 'xls': case 'xlsx': case 'csv': 
                return { text: 'XLS', color: '#6a9c65' };
            
            // 视频: 干燥玫瑰粉
            case 'mp4': case 'mov': case 'avi': case 'mkv': 
                return { text: 'MOV', color: '#a86588' };
            
            // 代码: 灰蓝
            case 'py': case 'js': case 'r': case 'css': case 'html': case 'java': case 'cpp': 
                return { text: 'CODE', color: '#6688aa' };
            
            // 文本: 稍微深一点的灰
            case 'txt': 
                return { text: 'TXT', color: '#666666' };
            
            // 默认: 保持低调灰
            default: return { text: ext, color: '#757575' };
        }
    }
}

export default class CustomSortPlugin extends Plugin {
    settings: CustomSortSettings;
    isRenameRefreshPending: boolean = false;
    originalRevealInFolder: any;

    async onload() {
        await this.loadSettings();
        // --- 核心修复：彻底删除这一行，不再在启动时销毁旧视图 ---
        // this.app.workspace.detachLeavesOfType(VIEW_TYPE_CUSTOM_SORT); 

        this.registerView(
            VIEW_TYPE_CUSTOM_SORT,
            (leaf) => new CustomSortView(leaf, this)
        );

        this.addSettingTab(new CustomSortSettingTab(this.app, this));

        this.addRibbonIcon('folder', '打开自定义排序', () => {
            this.activateView();
        });

        this.registerEvent(this.app.workspace.on('file-open', (file) => {
            if (file) {
                this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT).forEach(leaf => {
                    if (leaf.view instanceof CustomSortView) {
                        leaf.view.revealItem(file);
                    }
                });
            }
        }));

        this.app.workspace.onLayoutReady(() => {
            // @ts-ignore
            const internalPlugins = this.app.internalPlugins;
            if (internalPlugins) {
                const fileExplorerPlugin = internalPlugins.getPluginById('file-explorer');
                if (fileExplorerPlugin && fileExplorerPlugin.instance) {
                    this.originalRevealInFolder = fileExplorerPlugin.instance.revealInFolder;
                    fileExplorerPlugin.instance.revealInFolder = (item: TAbstractFile) => {
                        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT);
                        if (leaves.length > 0) {
                            this.app.workspace.revealLeaf(leaves[0]);
                            (leaves[0].view as CustomSortView).revealItem(item);
                        } else {
                            this.activateView().then(() => {
                                const newLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT);
                                if (newLeaves.length > 0) {
                                    (newLeaves[0].view as CustomSortView).revealItem(item);
                                }
                            });
                        }
                    };
                }
            }

            setTimeout(() => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT).forEach(leaf => {
                        if (leaf.view instanceof CustomSortView) {
                            leaf.view.revealItem(activeFile);
                        }
                    });
                }
            }, 1000);
        });

        this.registerEvent(this.app.vault.on('create', async (file) => {
            if (!this.isRenameRefreshPending && file instanceof TFile) {
                const parent = file.parent;
                const parentPath = parent ? parent.path : '/';
                
                if (!this.settings.order[parentPath]) {
                    const siblings = parent ? parent.children : this.app.vault.getRoot().children;
                    const defaultOrder = siblings
                        .filter(f => f.name !== file.name)
                        .map(f => f.name)
                        .sort((a, b) => a.localeCompare(b));
                    this.settings.order[parentPath] = defaultOrder;
                }
                
                const orderList = this.settings.order[parentPath];
                if (!orderList.includes(file.name)) {
                    orderList.push(file.name);
                } else {
                    orderList.remove(file.name);
                    orderList.push(file.name);
                }

                await this.saveSettings();
                this.refreshAllViews();
                
                setTimeout(() => {
                    this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT).forEach(leaf => {
                        (leaf.view as CustomSortView).revealItem(file);
                    });
                }, 300);
            }
        }));

        this.registerEvent(this.app.vault.on('rename', async (file, oldPath) => {
            this.isRenameRefreshPending = true;
            this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT).forEach(leaf => {
                const view = leaf.view as CustomSortView;
                if (view.activeFilePath === oldPath) view.activeFilePath = file.path;
            });

            if (file instanceof TFolder) {
                const oldPrefix = oldPath;
                const newPrefix = file.path;
                const newState: string[] = [];
                for (const path of this.settings.collapsedState) {
                    if (path === oldPrefix) newState.push(newPrefix);
                    else if (path.startsWith(oldPrefix + "/")) newState.push(path.replace(oldPrefix, newPrefix));
                    else newState.push(path);
                }
                this.settings.collapsedState = newState;
            }
            const parentPath = file.parent ? file.parent.path : '/';
            const orderList = this.settings.order[parentPath];
            if (orderList) {
                const oldName = oldPath.split('/').pop();
                if (oldName) {
                    const index = orderList.indexOf(oldName);
                    if (index !== -1) orderList[index] = file.name;
                }
            }
            await this.saveSettings();
            this.isRenameRefreshPending = false;
            this.refreshAllViews();
        }));

        this.registerEvent(this.app.vault.on('delete', () => {
            if (!this.isRenameRefreshPending) this.refreshAllViews();
        }));
    }

    onunload() {
        // @ts-ignore
        const internalPlugins = this.app.internalPlugins;
        if (internalPlugins && this.originalRevealInFolder) {
            const fileExplorerPlugin = internalPlugins.getPluginById('file-explorer');
            if (fileExplorerPlugin && fileExplorerPlugin.instance) {
                fileExplorerPlugin.instance.revealInFolder = this.originalRevealInFolder;
            }
        }
        // 核心修复：不要在卸载时销毁视图，让工作区记住它
    }

    refreshAllViews() {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT).forEach(leaf => {
            if (leaf.view instanceof CustomSortView) {
                leaf.view.refresh();
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;
        // 核心修复：严格检查是否已经存在，如果存在则复用，绝不新建
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_SORT);

        if (leaves.length > 0) {
            // 如果已经有了，就激活第一个，不做任何其他操作
            leaf = leaves[0];
        } else {
            // 只有真的没有时，才新建
            const newLeaf = workspace.getLeftLeaf(false);
            if (newLeaf) {
                leaf = newLeaf;
                await leaf.setViewState({ type: VIEW_TYPE_CUSTOM_SORT, active: true });
            }
        }
        if (leaf) workspace.revealLeaf(leaf);
    }
}