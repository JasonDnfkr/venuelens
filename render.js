// 解析 Streams 数据
// const streamList = source.split("\n").map(line => line.split(",")[0]);
const selectedStreams = new Set();
const authors = [];


// 全局变量，保存 stream 的门槛值
const streamThresholds = {};

// // 渲染 Streams 选择框
// const streamContainer = document.getElementById("stream-list");
// // 修改左侧 streams 列表渲染（原有代码修改）：
// streamList.forEach(stream => {
//     const div = document.createElement("div");
//     // 使用 onchange 事件传递当前复选框和 stream 名称
//     div.innerHTML = `<input type="checkbox" value="${stream}" onchange="toggleStream(this, '${stream}')"> ${stream}`;
//     streamContainer.appendChild(div);
// });

// 用于在左侧 .sidebar 渲染列表
function renderStreamList(data) {
    const streamContainer = document.getElementById("stream-list");
    if (!streamContainer) return;
    streamContainer.innerHTML = "";

    data.forEach(item => {
        // 外层容器：给每个 stream 项一个独立的 .stream-item
        const div = document.createElement("div");
        div.className = "stream-item";

        // 用模板字符串插入多层结构：
        div.innerHTML = `
          <!-- 复选框 -->
          <input type="checkbox"
                 value="${item.stream}"
                 onchange="toggleStream(this, '${item.stream}')">

          <!-- 文字部分：标题 + 标识符 -->
          <div class="stream-text">
            <!-- 第一行：显示真实名称 -->
            ${item.name}
            <!-- 第二行：右对齐显示标识符 -->
            <div class="stream-code">(${item.stream})</div>
          </div>
        `;

        // 插入到左侧列表
        streamContainer.appendChild(div);
    });
}



// 修改后的 toggleStream 函数
function toggleStream(checkbox, stream) {
    if (checkbox.checked) {
        selectedStreams.add(stream);
        // 创建门槛输入框
        let thresholdInput = document.createElement("input");
        thresholdInput.type = "number";
        thresholdInput.placeholder = "Threshold";
        thresholdInput.className = "stream-threshold";
        // 使用 stream 名创建一个唯一的 id（注意替换斜杠）
        thresholdInput.id = `threshold-${stream.replace('/', '-')}`;
        thresholdInput.onchange = function() {
            updateThreshold(stream, this.value);
        };
        // 将输入框添加到当前复选框所在的 div 中
        checkbox.parentElement.appendChild(thresholdInput);
    } else {
        selectedStreams.delete(stream);
        // 删除对应的门槛输入框
        let thresholdInput = document.getElementById(`threshold-${stream.replace('/', '-')}`);
        if (thresholdInput) {
            thresholdInput.parentElement.removeChild(thresholdInput);
        }
        // 移除该 stream 的门槛值
        delete streamThresholds[stream];
    }
}


// 更新门槛值的函数
function updateThreshold(stream, value) {
    let threshold = parseFloat(value);
    if (isNaN(threshold)) threshold = 0;
    streamThresholds[stream] = threshold;
}



// 添加作者
function addAuthor() {
    const input = document.getElementById("author-input");
    const name = input.value.trim();
    if (name && !authors.includes(name)) {
        authors.push(name);
        renderAuthors();
        input.value = "";
    }
}

// 渲染已添加的作者
function renderAuthors() {
    const authorList = document.getElementById("author-list");
    authorList.innerHTML = "";
    authors.forEach((author, index) => {
        const span = document.createElement("span");
        span.textContent = author;
        span.onclick = () => {
            authors.splice(index, 1);
            renderAuthors();
        };
        authorList.appendChild(span);
    });
}

// 在查询按钮的点击事件中，对查询结果进行过滤处理
document.getElementById("query-btn").onclick = async function () {
    const streams = Array.from(selectedStreams);
    
    if (streams.length === 0) {
        alert("Please select at least one stream.");
        return;
    }

    const queryPromises = streams.map(async (stream) => {
        const query = generateSparqlQuery([stream], authors);
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`https://sparql.dblp.org/sparql?query=${encodedQuery}`);
        return response.json();
    });

    try {
        const results = await Promise.all(queryPromises);
        const mergedData = mergeResults(results);
        
        // 对合并结果进行过滤：
        // 对于每个选中的 stream，如果用户填写了门槛（默认为数值，若未填写则视为 0），
        // 检查 author 在该 stream 对应的得分（字段名为 stream.split('/')[1]+'_weighted_score'）是否 >= 门槛
        const filteredData = mergedData.filter(author => {
            let include = true;
            selectedStreams.forEach(stream => {
                // 如果用户填写了门槛值，则进行过滤，否则默认为 0（不过0不会过滤掉任何结果）
                let threshold = streamThresholds[stream] || 0;
                const streamName = stream.split('/')[1];
                let score = author[`${streamName}_weighted_score`] || 0;
                if (score < threshold) {
                    include = false;
                }
            });
            return include;
        });

        renderTable(filteredData);

    } catch (error) {
        console.error("Query failed:", error);
        alert("Query failed. Please try again.");
    }
};



// **合并多个 JSON 结果，确保所有 weighted_score 列都完整**
function mergeResults(resultsArray) {
    let merged = {};
    let allWeightedScores = new Set(); // 存储所有出现过的 weighted_score 列名

    // **遍历所有 JSON 结果，收集所有可能的 weighted_score 列名**
    resultsArray.forEach(result => {
        result.results.bindings.forEach(entry => {
            Object.keys(entry).forEach((key) => {
                if (key.endsWith("_weighted_score")) {
                    allWeightedScores.add(key);
                }
            });
        });
    });

    // **合并数据**
    resultsArray.forEach(result => {
        result.results.bindings.forEach(entry => {
            const name = entry.name.value;
            const affiliation = entry.affiliation ? entry.affiliation.value : "Unknown";

            if (!merged[name]) {
                merged[name] = { name, affiliation, total_weighted_score: 0 };
                // **初始化所有 weighted_score，防止丢失列**
                allWeightedScores.forEach(scoreKey => {
                    merged[name][scoreKey] = 0;
                });
            }

            // **填充 weighted_score 数据**
            Object.keys(entry).forEach((key) => {
                if (key.endsWith("_weighted_score")) {
                    const score = parseFloat(entry[key].value) || 0;
                    merged[name][key] = score;
                    merged[name].total_weighted_score += score; // 计算总分
                }
            });
        });
    });

    return Object.values(merged);
}


// 分页相关变量
let currentPage = 1;
const rowsPerPage = 20;
let sortedData = []; // 存储排序后的数据

let showAffiliation = false; // 记录当前显示状态

// **切换 Affiliation 显示状态**
document.getElementById("toggle-affiliation").onclick = function () {
    showAffiliation = !showAffiliation;
    renderTable(sortedData); // 重新渲染表格
    this.textContent = showAffiliation ? "Hide Affiliation" : "Show Affiliation";
};

// **修改 renderTable()，动态控制 Affiliation 列**
function renderTable(data) {
    sortedData = data.sort((a, b) => (b.total_weighted_score || 0) - (a.total_weighted_score || 0));
    renderPage(1);
    renderPagination();
}

// **修改 renderPage()，根据 showAffiliation 决定是否显示该列**
function renderPage(page) {
    const tableHead = document.querySelector("#result-table thead");
    const tableBody = document.querySelector("#result-table tbody");

    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    if (sortedData.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='5'>No results found</td></tr>";
        return;
    }

    let columns = ["name"];
    if (showAffiliation) columns.push("affiliation"); // 动态添加 Affiliation 列
    columns.push("total_weighted_score");

    let weightedScoreColumns = Object.keys(sortedData[0]).filter(k => k.endsWith("_weighted_score") && k !== "total_weighted_score");
    columns = [...columns, ...weightedScoreColumns];

    // **渲染表头**
    const headerRow = document.createElement("tr");
    columns.forEach((col) => {
        const th = document.createElement("th");
        th.textContent = col;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // **渲染数据**
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = sortedData.slice(start, end);

    pageData.forEach(row => {
        const tr = document.createElement("tr");
        columns.forEach(col => {
            const td = document.createElement("td");
            td.textContent = row[col] !== undefined ? row[col] : "-";
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });

    currentPage = page;
}


// **分页按钮**
function renderPagination() {
    const paginationContainer = document.getElementById("pagination");
    paginationContainer.innerHTML = ""; // 清空旧分页

    const totalPages = Math.ceil(sortedData.length / rowsPerPage);
    if (totalPages <= 1) return; // 只有一页时不显示分页

    // **创建 "上一页" 按钮**
    const prevButton = document.createElement("button");
    prevButton.textContent = "Prev";
    prevButton.className = "pagination-btn";
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => changePage(currentPage - 1);
    paginationContainer.appendChild(prevButton);

    // **创建输入框**
    const pageInput = document.createElement("input");
    pageInput.type = "text"; // 改为 text 防止 number 默认行为
    pageInput.value = currentPage;
    pageInput.className = "pagination-input";
    pageInput.onkeydown = (e) => {
        if (e.key === "ArrowUp") {
            changePage(currentPage + 1);
        } else if (e.key === "ArrowDown") {
            changePage(currentPage - 1);
        }
    };
    pageInput.onchange = () => {
        let pageNumber = parseInt(pageInput.value);
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            changePage(pageNumber);
        } else {
            pageInput.value = currentPage;
        }
    };
    paginationContainer.appendChild(pageInput);

    // **显示总页数**
    const totalPagesText = document.createElement("span");
    totalPagesText.textContent = ` / ${totalPages}`;
    totalPagesText.className = "pagination-text";
    paginationContainer.appendChild(totalPagesText);

    // **创建 "下一页" 按钮**
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-btn";
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => changePage(currentPage + 1);
    paginationContainer.appendChild(nextButton);
}

// **页面跳转**
function changePage(page) {
    if (page < 1 || page > Math.ceil(sortedData.length / rowsPerPage)) return;
    renderPage(page);
    renderPagination(); // 更新分页按钮
}