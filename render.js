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

// **合并 JSON 结果，确保 `total_weighted_score` 不重复**
function mergeResults(resultsArray) {
    let merged = {};
    
    resultsArray.forEach(result => {
        result.results.bindings.forEach(entry => {
            const name = entry.name.value;
            const affiliation = entry.affiliation ? entry.affiliation.value : "Unknown";

            if (!merged[name]) {
                merged[name] = { name, affiliation, total_weighted_score: 0 };
            }

            // 遍历 JSON 头部，合并 `weighted_score`
            Object.keys(entry).forEach((key) => {
                if (key.endsWith("_weighted_score")) {
                    const score = parseFloat(entry[key].value) || 0;
                    merged[name][key] = score; // 存储每个 stream 的 weighted_score
                    merged[name].total_weighted_score += score; // 计算 total_weighted_score
                }
            });
        });
    });

    return Object.values(merged);
}

// **修正 `renderTable()`，避免重复的 `total_weighted_score`**
function renderTable(data) {
    const tableHead = document.querySelector("#result-table thead");
    const tableBody = document.querySelector("#result-table tbody");

    // 清空表格
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='5'>No results found</td></tr>";
        return;
    }

    // **确保 `total_weighted_score` 只出现一次**
    let columns = ["name", "affiliation", "total_weighted_score"];
    let weightedScoreColumns = Object.keys(data[0]).filter(k => k.endsWith("_weighted_score") && k !== "total_weighted_score");

    columns = [...columns, ...weightedScoreColumns]; // 合并列名，避免重复

    // 渲染表头
    const headerRow = document.createElement("tr");
    columns.forEach((col) => {
        const th = document.createElement("th");
        th.textContent = col;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // 渲染数据
    data.forEach(row => {
        const tr = document.createElement("tr");
        columns.forEach(col => {
            const td = document.createElement("td");
            td.textContent = row[col] !== undefined ? row[col] : "-";
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
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
