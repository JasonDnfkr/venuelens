
const GET_STREAM_NAME = `https://sparql.dblp.org/sparql?query=PREFIX+rdfs%3A+%3Chttp%3A%2F%2Fwww.w3.org%2F2000%2F01%2Frdf-schema%23%3E%0APREFIX+dblp%3A+%3Chttps%3A%2F%2Fdblp.org%2Frdf%2Fschema%23%3E%0ASELECT+%3Fvenue+%3Fvenue_label+%3Fpub+%3Fpub_label+WHERE+%7B%0A+++%3Fvenue+++++++a++++++++++++++++++++++++dblp%3AStream+.%0A+++%3Fvenue+++++++rdfs%3Alabel+++++++++++++++%3Fvenue_label+.%0A%7D%0A`

function encodeString(str) {
  return str
    .split('')
    .map(char => {
      // 保留数字和英文字符
      if (/[a-zA-Z0-9]/.test(char)) {
        return char;
      }
      // 将空格替换为加号
      if (char === ' ') {
        return '+';
      }
      // 手动替换括号
      if (char === '(') {
        return '%28'; // 左括号
      }
      if (char === ')') {
        return '%29'; // 右括号
      }
      // 其他符号用URL编码
      return encodeURIComponent(char);
    })
    .join('');
}


function requestSparqlAPI(queryString) {
  // 拼接 URL
  const url = `https://sparql.dblp.org/sparql?query=${queryString}`;

  // 返回一个 Promise，异步处理结果
  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json(); // 解析 JSON 数据
    })
    .then(data => {
      // 假设你需要返回 JSON 中的某个值（例如：返回 name 列表）
      return JSON.stringify(data);
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
      return null; // 在出错时返回 null
    });
}

// Generate sparql query sentence.
function generateSparqlQuery(streams, authors) {
  const rdf_prefix = 'PREFIX dblp: <https://dblp.org/rdf/schema#>\nPREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>';
  const prefix = 'https://dblp.org/streams/';

  // 用于构建 SELECT 语句中的 SUM 操作部分
  const sumOperations = streams.map(stream => {
    const streamName = stream.split('/')[1];  // 获取会议名称，例如 'chi', 'iui', 'tochi'
    return `(SUM(IF(BOUND(?${streamName}_score), ?${streamName}_score, 0)) AS ?${streamName}_weighted_score)`;
  }).join('\n       ');  // 将各个 SUM 语句拼接起来

  // 用于构建 UNION 语句的部分
  const unionQueries = streams.map((stream, index) => {
    const streamName = stream.split('/')[1];  // 获取会议名称，例如 'chi', 'iui', 'tochi'
    const str_union = 'UNION\n';

    const q = `
  {
  SELECT ?pub ?pub_label ?name ?page ?page_count ?affiliation ?nr ?${streamName}_score WHERE {
    ?pub         dblp:publishedInStream    ?stream .
    VALUES ?stream { <${prefix}${stream}> }
    ?pub         rdfs:label                ?pub_label .
    ?pub         dblp:hasSignature         ?sig .
    ?sig         dblp:signatureOrdinal     ?nr .
    ?sig         dblp:signatureDblpName    ?name .
    ?sig         dblp:signatureCreator     ?pers .
    
   
    {
    SELECT ?pub (COUNT(?sig) AS ?total_authors) WHERE {
            ?pub dblp:hasSignature ?sig .
    }
    GROUP BY ?pub
    }
    
    BIND(
      IF(?total_authors = 1, 
        1,
        IF(?nr = 1 || ?nr = ?total_authors, 
        1, 
        1 / ?total_authors
        )
      ) 
    AS ?${streamName}_score
    )
    
    
    ?pub dblp:pagination ?page .
    BIND(
      IF(REGEX(STR(?page), "\\\\A\\\\d+$"), 
        1, 
        (
        IF(REGEX(STR(?page), "\\\\A\\\\S+:\\\\d+-\\\\S+:\\\\d+$"), 
            ( xsd:integer(  STRAFTER(STRAFTER(STR(?page), "-"), ":")  )  -  xsd:integer(  STRAFTER(STRBEFORE(STR(?page), "-"), ":")  )) + 1,
              (
                IF(REGEX(STR(?page), "\\\\A\\\\d+-\\\\d+$"), 
                (xsd:integer(STRAFTER(STR(?page), "-")) - xsd:integer(STRBEFORE(STR(?page), "-")) + 1),
                0
              )
            )
          )
        )
        )
        AS ?page_count
    )
    FILTER (?page_count > 6 || ?page_count = 1)
    
    OPTIONAL {
      ?pers        dblp:primaryAffiliation  ?affiliation .
    }
  }
}`;
    return index === 0 ? q : str_union + q;
  }).join('');

  // 处理 authors 过滤条件
  let authorFilter = '';
  if (authors.length > 0) {
    if (authors.length === 1) {
      // 只有一个作者，使用简单的 FILTER
      authorFilter = `FILTER(?name = "${authors[0]}")`;
    } else {
      // 多个作者，使用 IN 关键字
      const authorValues = authors.map(author => `"${author}"`).join(', ');
      authorFilter = `FILTER(?name IN (${authorValues}))`;
    }
  }

  // 处理 weighted_score
  const weightedScore = streams.map((stream) => {
    const streamName = stream.split('/')[1];  // 获取会议名称，例如 'chi', 'iui', 'tochi'
    return ` DESC (?${streamName}_weighted_score)`
  }).join('')

  // 完整的 SPARQL 查询字符串
  const query = `
SELECT ?name 
     ?affiliation
     ${sumOperations}
WHERE {
${unionQueries}

${authorFilter}
}
GROUP BY ?name ?affiliation
ORDER BY ${weightedScore}
`;


  return rdf_prefix + query;
}


function callQlever(encodedString) {
  return requestSparqlAPI(encodedString)
    .then(result => {
      console.log('Returned string:', result); // 在这里处理返回的字符串
      return result;
    });
}


async function parseCSV(csvString) {
  const requestUrl = GET_STREAM_NAME;
  let venueMap = {};

  try {
    // 发送 GET 请求获取 JSON 数据
    const response = await fetch(requestUrl);
    const jsonData = await response.json();

    // 解析 JSON，构建映射表 venueMap
    jsonData.results.bindings.forEach(item => {
      const venueKey = item.venue.value.replace("https://dblp.org/streams/", ""); // 提取 conf/xxx 或 journals/xxx
      const venueLabel = item.venue_label.value; // 会议/期刊的正式名称
      venueMap[venueKey] = venueLabel;
    });
  } catch (error) {
    console.error("Error fetching venue data:", error);
  }

  // 按行拆分 CSV 数据
  const lines = csvString.trim().split('\n');
  const result = [];

  // 解析每一行
  lines.forEach(line => {
    const columns = line.split(',').map(item => item.trim()); // 解析逗号分隔的字段
    const stream = columns[0]; // 获取第一列（conf/xxx 或 journals/xxx）
    const values = columns.slice(1); // 其余列为 values

    // 在 venueMap 中查找匹配的 name（会议/期刊名称）
    const name = venueMap[stream] || "Unknown"; // 若找不到，默认填充 "Unknown"

    result.push({
      stream,
      name, // 新增字段，存储会议/期刊的名称
      values
    });
  });

  return result;
}




// source csv data

const source = `conf/chi,129,183,
conf/uist,51.72,
conf/iui,52,90,
conf/cscw,81,126,pacmhci
conf/group,81,126,pacmhci
conf/tabletop,81,126,pacmhci
conf/automotiveUI,,,
conf/candc,,,
conf/chiplay,,,pacmhci
conf/ci2,,,
conf/dev,,,
conf/cui,,,
conf/ACMdis,49,62,
conf/eics,81,126,pacmhci
conf/etra,81,126,pacmhci
conf/hri,54,76,
conf/icmi,,,
conf/acmidc,,,
conf/tvx,,,
conf/iui,52,90,
conf/mhci,81,126,pacmhci
conf/recsys,,,
conf/sui,,,
conf/tei,,,
conf/um,,,
conf/huc,58,85,imwut
conf/iswc,,,
conf/assets,,,
conf/vrst,,,
conf/avi,,,
conf/mum,,,
conf/mc,,,
conf/graphicsinterface,,,
conf/mm,,,
conf/interact,,,
conf/nordichi,,,
conf/ozchi,,,
conf/acii,,,
conf/vr,48,67,
conf/ismar,,,
conf/visualization,,,
conf/vissym,,,
conf/siggraph,,,
conf/siggrapha,,,
conf/sigcse,47,61,
conf/vl,18,27,
conf/lats,23,33,
journals/ijcci,38,59,
journals/tomccap,,,
journals/uais,46,61,
journals/tog,,,
journals/cgf,,,
journals/cg,,,
journals/taccess,,,
journals/imwut,58,85,
journals/thms,43,68,
journals/tochi,47,69,
journals/ijmms,67,109,
journals/hhci,,,
journals/iwc,,,
journals/ijhci,65,97,
journals/behaviourIT,63,93,
journals/tvcg,,,
journals/pacmhci,,,
journals/taffco,,,
journals/thri,,,
journals/vr,59,104,
journals/ijim,56,73,`


// script.js 末尾新增：
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 调用 parseCSV，返回形如 [{stream: "conf/chi", name: "ACM CHI Conference...", values: [...]}, ...]
    const data = await parseCSV(source);

    // 调用 renderStreamList，将解析后的 data 交给它
    // 注意：renderStreamList 在 render.js 中定义
    if (window.renderStreamList) {
      window.renderStreamList(data);
    }
  } catch (e) {
    console.error("Error while parsing CSV:", e);
  }
});
