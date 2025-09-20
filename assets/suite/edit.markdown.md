# Markdown 编辑规范

## 章节关系

编辑 Markdown 文档时，必须保持章节之间的包含关系和 Sibling 关系不变。

下文使用 $\sim$ 表示 Sibling 关系，使用 $\subset$ 表示包含关系。

### 示例

```markdown
# Heading A
Body A
## Heading B
Body B
## Heading C
Body C
```

不能被编辑为

```markdown
# Heading A
Body A
# Heading B
Body B
## Heading C
Body C
```

即不能将 Heading B 从 2 级提升到 1 级。

因为

-	编辑前，$C\sim B\subset A$
-	编辑后，$C\subset B\sim A$

章节之间的包含关系或 Sibling 关系，在编辑后发生了变化。

### 示例

```markdown
# Heading A
Body A
#### Heading B
Body B
```

可以被编辑为

```markdown
# Heading A
Body A
## Heading B
Body B
```

即可以将 Heading B 从 4 级提升到 2 级。

因为

-   编辑前，$B\subset A$
-   编辑后，$B\subset A$

章节之间的包含关系和 Sibling 关系，在编辑后没有发生变化。

### 示例

```markdown
# Heading A
Body A
## Heading B
Body B
### Heading C
Body C
```

不能被编辑为

```markdown
# Heading A
Body A
Body B
### Heading C
Body C
```

即不能删除 Heading B。

因为

-   编辑前，$B\subset A$
-   编辑后，$B\sim A$

章节之间的包含关系或 Sibling 关系，在编辑后发生了变化。

### 示例

```markdown
# Heading A
## Heading B
Body B
### Heading C
Body C
```

可以被编辑为

```markdown
# Heading A
Body B
### Heading C
Body C
```

即可以在不存在 Body A 的情况下删除 Heading B。

因为

-   编辑前，$C\subset B\subset A$
-   编辑后，$C\subset B\subset A$

章节之间的包含关系或 Sibling 关系，在编辑后没有发生变化。

### 示例

```markdown
# Heading A
### Heading B
### Heading C
```

不能被编辑为

```markdown
# Heading A
### Heading B
## Heading C
```

即不能将 Heading C 从 3 级提升到 2 级。

因为

-	编辑前，$B\sim C$
-	编辑后，$B\not\sim C$

章节之间的包含关系或 Sibling 关系，在编辑后发生了变化。

### 示例

```markdown
# Heading A
### Heading B
# Heading C
### Heading D
```

可以被编辑为

```markdown
# Heading A
### Heading B
# Heading C
## Heading D
```

即可以将 Heading D 从 3 级提升到 2 级。

因为

-	编辑前
	-	$B\subset A$
	-	$D\subset C$
	-	$C\sim A$
	-	$B,D$ 之间在章节树形结构中属于远方亲戚，既无包含关系也无 Sibling 关系
-	编辑后
	-	$B\subset A$
	-	$D\subset C$
	-	$C\sim A$
	-	$B,D$ 之间在章节树形结构中属于远方亲戚，既无包含关系也无 Sibling 关系

章节之间的包含关系或 Sibling 关系，在编辑后没有发生变化。

### 示例

```markdown
# Heading A
Body A
## Heading B
Body B
```

可以被编辑为

```markdown
Body A
## Heading B
Body B
```

即可以删除 Heading A。

因为

-   编辑前，$B\subset A$
-   编辑后，Body A 不隶属于任何 heading，相当于隶属于 0 级 root heading，$B\subset A$

章节之间的包含关系或 Sibling 关系，在编辑后没有发生变化。

### 示例

```markdown
# Heading A
Body A
## Heading B
Body B
## Heading C
Body C
```

可以被编辑为

```markdown
## Heading B
Body B
## Heading C
Body C
```

即可以删除 Heading A 和 Body A。

因为

-   编辑前，$C\sim B$
-   编辑后，$C\sim B$

章节之间的包含关系或 Sibling 关系，在编辑后没有发生变化。

## 序号连续

有序列表项目或含序号的 heading 被增加或删除后，请调整所有序号使其连续。

### 示例

```markdown
1. 项目 A
2. 项目 B
3. 项目 C
```

不能被编辑为

```markdown
1. 项目 A
3. 项目 C
```

而应当被编辑为

```markdown
1. 项目 A
2. 项目 C
```

### 示例

```markdown
## 1. 项目 A
## 2. 项目 B
## 3. 项目 C
```

不能被编辑为

```markdown
## 1. 项目 A
## 3. 项目 C
```

而应当被编辑为

```markdown
## 1. 项目 A
## 2. 项目 C
```
