const query = `
PREFIX dblp: <https://dblp.org/rdf/schema#>

SELECT ?name 
       ?affiliation
       (SUM(IF(BOUND(?chi_score), ?chi_score, 0)) AS ?chi_weighted_score)
       (SUM(IF(BOUND(?iui_score), ?iui_score, 0)) AS ?iui_weighted_score)
       (SUM(IF(BOUND(?tochi_score), ?tochi_score, 0)) AS ?tochi_weighted_score)
WHERE {
  # 计算CHI会议中的得分
  {
    SELECT ?publication ?name ?nr ?chi_score ?affiliation WHERE { 
      ?publication dblp:publishedInStream <https://dblp.org/streams/conf/chi> .
      ?publication dblp:hasSignature ?sig .
      ?sig dblp:signatureOrdinal ?nr .
      ?sig dblp:signatureDblpName ?name .
      ?sig dblp:signatureCreator ?pers .  # 获取作者实体
      ?pers dblp:primaryAffiliation ?affiliation .  # 获取作者的affiliation
      {
        SELECT ?publication (COUNT(?sig) AS ?total_authors) WHERE {
          ?publication dblp:hasSignature ?sig .
        }
        GROUP BY ?publication
      }
      # 计算CHI会议的得分
      BIND(
        IF(?total_authors = 1, 1,
          IF(?nr = 1 || ?nr = ?total_authors, 1,
            1 / ?total_authors
          )
        ) AS ?chi_score
      )
    }
  }

  # 计算IUI会议中的得分
  UNION
  {
    SELECT ?publication ?name ?nr ?iui_score ?affiliation WHERE {
      ?publication dblp:publishedInStream <https://dblp.org/streams/conf/iui> .
      ?publication dblp:hasSignature ?sig .
      ?sig dblp:signatureOrdinal ?nr .
      ?sig dblp:signatureDblpName ?name .
      ?sig dblp:signatureCreator ?pers .  # 获取作者实体
      ?pers dblp:primaryAffiliation ?affiliation .  # 获取作者的affiliation
      {
        SELECT ?publication (COUNT(?sig) AS ?total_authors) WHERE {
          ?publication dblp:hasSignature ?sig .
        }
        GROUP BY ?publication
      }
      # 计算IUI会议的得分
      BIND(
        IF(?total_authors = 1, 1,
          IF(?nr = 1 || ?nr = ?total_authors, 1,
            1 / ?total_authors
          )
        ) AS ?iui_score
      )
    }
  }
  
  # 计算 TOCHI 会议中的得分
  UNION
  {
    SELECT ?publication ?name ?nr ?tochi_score ?affiliation WHERE {
      ?publication dblp:publishedInStream <https://dblp.org/streams/journals/tochi> .
      ?publication dblp:hasSignature ?sig .
      ?sig dblp:signatureOrdinal ?nr .
      ?sig dblp:signatureDblpName ?name .
      ?sig dblp:signatureCreator ?pers .  # 获取作者实体
      ?pers dblp:primaryAffiliation ?affiliation .  # 获取作者的affiliation
      {
        SELECT ?publication (COUNT(?sig) AS ?total_authors) WHERE {
          ?publication dblp:hasSignature ?sig .
        }
        GROUP BY ?publication
      }
      # 计算IUI会议的得分
      BIND(
        IF(?total_authors = 1, 1,
          IF(?nr = 1 || ?nr = ?total_authors, 1,
            1 / ?total_authors
          )
        ) AS ?tochi_score
      )
    }
  }

  # 过滤指定的作者
  FILTER(?name = "Per Ola Kristensson")
}
GROUP BY ?name ?affiliation
ORDER BY DESC (?chi_weighted_score) DESC (?iui_weighted_score) DESC (?tochi_weighted_score)
`;

console.log(query);


