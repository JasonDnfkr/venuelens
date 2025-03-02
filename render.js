// 解析 Streams 数据
const streamList = source.split("\n").map(line => line.split(",")[0]);
const selectedStreams = new Set();
const authors = [];

// 渲染 Streams 选择框
const streamContainer = document.getElementById("stream-list");
streamList.forEach(stream => {
    const div = document.createElement("div");
    div.innerHTML = `<input type="checkbox" value="${stream}" onclick="toggleStream('${stream}')"> ${stream}`;
    streamContainer.appendChild(div);
});

// 处理 Streams 选择
function toggleStream(stream) {
    if (selectedStreams.has(stream)) {
        selectedStreams.delete(stream);
    } else {
        selectedStreams.add(stream);
    }
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

// 执行查询
document.getElementById("query-btn").onclick = async function () {
    const streams = Array.from(selectedStreams);
    
    if (streams.length === 0) {
        alert("Please select at least one stream.");
        return;
    }

    // 处理每个 stream 作为单独查询
    const queryPromises = streams.map(async (stream) => {
        const query = generateSparqlQuery([stream], authors); // 逐个查询 streams
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`https://sparql.dblp.org/sparql?query=${encodedQuery}`);
        return response.json(); // 返回 JSON 结果
    });

    try {
        // 并行执行所有查询
        const results = await Promise.all(queryPromises);

        // 合并所有 JSON 结果，并计算 `total_weighted_score`
        const mergedData = mergeResults(results);
        
        // 渲染合并后的结果
        renderTable(mergedData);

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

let showAffiliation = true; // 记录当前显示状态

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






// main


// const references = ['conf/chi', 'conf/iui', 'journals/tochi'];
// const authors = ['Patrick Olivier', 'Per Ola Kristensson', 'Shumin Zhai']
// const querySparql = generateSparqlQuery(references, authors);

// console.log(querySparql);

// const encodedString = encodeString(querySparql);

// console.log(encodedString);

// result = callQlever(encodedString);
// console.log(result);


// let table;

// // 使用示例
// (async () => {
//   table = await parseCSV(source);
//   console.log(table);
// })();
