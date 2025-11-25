# Obsidian 文件排序插件

可实现新增一个左边栏的视图，类似系统自带的文件列表视图，但在其中可自由拖动对文件排序

### 外貌

界面大概长这样，最外层文件夹会用不同的颜色区分，.md以外的文件类型，右边会显示文件类型的图标：

<img width="365" height="614" alt="image" src="https://github.com/user-attachments/assets/a8d7ba32-ee0f-457b-babe-44be23526ab9" />

打开插件后功能区会出现一个文件夹图标（如左边的红圈所示），点开后会在左边栏新增一个视图（如右边红圈所示）

### 功能

1. 支持自由拖拽排序文件和文件夹
2. 右侧打开一个文件时，左边视图会自动滚动切换到该文件所在位置，并对该文件所在行高亮
3. 鼠标移动到一个文件夹所在行上面时，会对该文件夹中文件的区域高亮

<img width="355" height="496" alt="image" src="https://github.com/user-attachments/assets/17e44247-7265-41d3-b223-8689b6d38e84" />

	示例图：此时右边开着“文件二”，同时鼠标在“子文件夹”这一行上方，可以看到对应的高亮

4. 对文件和文件夹的操作：和系统原生的文件系统中一样，右键单击可显示操作列表。对于文件夹，我们做了一些小改动，鼠标悬浮在上面时可看到右侧两个按钮，点击加号可直接在其中新建markdown文件，想要新建子文件夹或白板，可鼠标悬浮在加号上，会显示这些选项：

<img width="275" height="171" alt="image" src="https://github.com/user-attachments/assets/59a40e4b-7578-455b-9331-b9840ce9fc48" />

左边的两个箭头的按钮，点击后会一键展开/闭合该文件夹的所有子文件夹

5. 支持设置下图中所示选项：

<img width="1023" height="517" alt="image" src="https://github.com/user-attachments/assets/2cbb9518-c540-4d9e-a85d-583c6b511ed4" />

下图为调大了行间距和缩进距离，以及把所有颜色设置成灰色后的显示效果：

<img width="352" height="776" alt="image" src="https://github.com/user-attachments/assets/bed69dc8-15a4-493f-86c3-f1cc8c9f5f71" />

### 局限性

1. 暂不支持把文件拖拽到处于闭合状态的文件夹中，如果想这么做，要先点击展开那个文件夹
2. 第一次打开一个工作区时需要重新点击状态栏中的图标打开此插件的界面；并且还可能多出一个“幽灵界面”，如图：

<img width="454" height="599" alt="image" src="https://github.com/user-attachments/assets/713c284c-baa5-4cbd-87ba-1ae688cc3fc8" />

不过对一个工作区，只要打开过一次，并在其中打开插件界面、删除“幽灵界面”后保存工作区，下次再打开它时就不会再出问题

3. 插件刚打开时，所有文件夹中的排序方式默认都是按字母排序，如果进行了手动排序，之后便只保留手动排序的结果。无法自由切换其他排序方式（按时间排序等）
