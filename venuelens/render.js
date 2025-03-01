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
document.getElementById("query-btn").onclick = async function() {
    const streams = Array.from(selectedStreams);
    if (streams.length === 0) {
        alert("Please select at least one stream.");
        return;
    }

    const query = generateSparqlQuery(streams, authors);
    const encodedQuery = encodeString(query);
    const response = await fetch(`https://sparql.dblp.org/sparql?query=${encodedQuery}`);
    const data = await response.json();
    
    renderTable(data);
};

// 渲染查询结果表格
function renderTable(data) {
    const tableHead = document.querySelector("#result-table thead");
    const tableBody = document.querySelector("#result-table tbody");

    // 清空表格
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    // 渲染表头
    const headerRow = document.createElement("tr");
    data.head.vars.forEach(varName => {
        const th = document.createElement("th");
        th.textContent = varName;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // 渲染表格数据
    data.results.bindings.forEach(row => {
        const tr = document.createElement("tr");
        data.head.vars.forEach(varName => {
            const td = document.createElement("td");
            td.textContent = row[varName] ? row[varName].value : "-";
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
