(async () => {
    if (!window.gl || !window.gon) {
        return;
    }
    
    const getToken = () => {
        return document.head.querySelector('meta[name="csrf-token"]').getAttribute('content');
    };

    const callJob = () => {
        return fetch(gon.gitlab_url+'/api/graphql', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-csrf-token': getToken(),
            }, 
            body: JSON.stringify({
                query: `query pathLastCommit($projectPath: ID!, $path: String, $ref: String!) {
                  project(fullPath: $projectPath) {
                    __typename
                    id
                    repository {
                      __typename
                      paginatedTree(path: $path, ref: $ref) {
                        __typename
                        nodes {
                          __typename
                          lastCommit {
                    __typename
                            id
                            sha
                            title
                            titleHtml
                            descriptionHtml
                            message
                            webPath
                            authoredDate
                            authorName
                            authorGravatar
                            author {
                              __typename
                              id
                              name
                              avatarUrl
                              webPath
                            }
                            signatureHtml
                            pipelines(ref: $ref, first: 1) {
                              __typename
                              edges {
                                __typename
                                node {
                                  __typename
                                  id
                                  jobArtifacts{
                                    fileType
                                    downloadPath
                                    name
                                  }
                                  detailedStatus {
                                    __typename
                                    id
                                    detailsPath
                                    icon
                                    tooltip
                                    text
                                    group
                                  }
                                }
                              }
                            }
                          }

                        }
                      }
                    }
                  }
                }`,
                variables: {
                  "projectPath": getProjectPath(),
                  "ref": getRef(),
                  "path": ""
                }
            })
        }).then(r => r.json());
    };
    
    const getProjectPath = () => {
        if (gl?.startup_graphql_calls?.[0]?.variables?.projectPath) {
            return gl.startup_graphql_calls[0].variables.projectPath;
        }
        return document.location.href.toString().match(new RegExp(`^${gon.gitlab_url}/([^/]+/[^/]+)`))[1];
    };
    
    const getRef = () => {
        if (gl?.startup_graphql_calls?.[0]?.variables?.ref) {
            return gl.startup_graphql_calls[0].variables.ref;
        }
        return document.location.href.toString().match(new RegExp(`^${gon.gitlab_url}/[^/]+/[^/]+/-/blob/([^/]+)`))[1];
    };

    const getArtefacts = async () => {
        try {
            const data = await callJob();
            return data.data.project.repository.paginatedTree.nodes[0].lastCommit.pipelines.edges[0].node.jobArtifacts
        } catch(e) {
        }
        return [];
    }


    const getCoverageFilePath = async () => {
        const artefacts = await getArtefacts();
        for (const artefact of artefacts) {
            if (artefact.fileType == 'COBERTURA') {
                return artefact.downloadPath;
            }
        }
        return null;
    }


    const getCoverrage = async () => {
        try {
        
            const filePath = await getCoverageFilePath();
            if (!filePath) {
                return null;
            }
            const r = await fetch(gon.gitlab_url+filePath, {
                headers: {
                    'Content-Encoding': 'gzip',
                    'Content-Type': 'application/json'
                }
            });
            const body = await r.body;
        
            const decompressedReadableStream = body.pipeThrough(
              new DecompressionStream('gzip')
            );

            let buffer = new Uint8Array(0);
            const reader = decompressedReadableStream.getReader();
            while (true) { // eslint-disable-line no-constant-condition
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                const newResult = new Uint8Array(buffer.length + value.length);
                newResult.set(buffer);
                newResult.set(value, buffer.length);
                buffer = newResult;
            }
            const text = new TextDecoder().decode(buffer);
            return text;
        }catch(e) {
            console.error(e);
        }
    };

    const getDomCoverage = async() => {
        const text = await getCoverrage();
        if (text) {
            parser = new DOMParser();
            return parser.parseFromString(text,"text/xml");
        }
        return null;
    };

    const getPath = () => {
        let path = [...document.querySelectorAll('.repo-breadcrumb .breadcrumb-item')].map(li => li.innerText.trim()).join('/');
        path = path.substr(path.indexOf('/') + 1);
        return path.substr(0, path.lastIndexOf('/') + 1);
    };

    const getColor = (rate) => {
        if (rate > 0.9) {
            return '#28a745';
        }
        if (rate > 0.5) {
            return '#ffc107';
        }
        return '#dc3545';
    };

    let dom = null;
    let zIndex = 1000;

    const applyCoverageOnPath = (file, td) => {
        
        const classRates = [];
        const methodRates = [];
        const lineRates = [];
        
        dom.querySelectorAll('[filename]').forEach(node => {
            const nodeFilename = node.getAttribute('filename');
            if (nodeFilename.indexOf(file) === 0) {
          
                classRates.push(node.getAttribute('line-rate') === '1');
                
                
                node.querySelectorAll('method').forEach(method => {
                    methodRates.push(method.getAttribute('line-rate') === '1');
                });
                
                node.querySelectorAll('line').forEach(line => {
                    lineRates.push(line.getAttribute('hits') !== '0');
                });
            }
        });
        
        const classCover = classRates.filter(r => r).length;
        const classTotal = classRates.length;
        const classRate = classCover / classTotal;
        
        const methodCover = methodRates.filter(r => r).length;
        const methodTotal = methodRates.length; 
        const methodRate = methodCover / methodTotal;
        
        const lineCover = lineRates.filter(r => r).length;
        const lineTotal = lineRates.length;
        const lineRate = lineCover / lineTotal;
        
        if (!lineTotal) {
            return;
        }
        
        const parser = new DOMParser();
        const div = parser.parseFromString(`
            <div
                class="coverage-hover"
                style="
                    height: 100%;
                    width: 9px;
                    position: absolute;
                    left: 0;
                    top: 0;
                    z-index: 10;
                "
            >
                <div style="
                    position: absolute;
                    height: 100%;
                    width: 3px;
                    background: ${getColor(lineRate)};
                    top: 0;
                    left: 0;
                " rate="${lineRate}"></div>
                <div style="
                    position: absolute;
                    height: 100%;
                    width: 3px;
                    background: ${getColor(methodRate)};
                    top: 0;
                    left: 3px;
                " rate="${methodRate}"></div>
                <div style="
                    position: absolute;
                    height: 100%;
                    width: 3px;
                    background: ${getColor(classRate)};
                    top: 0;
                    left: 6px;
                " rate="${classRate}"></div>
                <div class="coverage-hovered" style="position: absolute;bottom: 20px;left: 0px;border: 1px solid #000;z-index: 10;box-shadow: 1px 1px 8px #000;">
                    <div style="white-space: nowrap;padding: 2px 10px; background: ${getColor(lineRate)};">Lines: <b>${Math.round(lineRate * 1000) / 10}% ${lineCover}/${lineTotal}</b></div>
                    <div style="white-space: nowrap;padding: 2px 10px; background: ${getColor(methodRate)};">Methods: <b>${Math.round(methodRate * 1000) / 10}% ${methodCover}/${methodTotal}</b></div>
                    <div style="white-space: nowrap;padding: 2px 10px; background: ${getColor(classRate)};">Class: <b>${Math.round(classRate * 1000) / 10}% ${classCover}/${classTotal}</b></div>
                </div>
                <style>
                    .coverage-hover:hover .coverage-hovered {
                        opacity: 1;
                    }
                    .coverage-hovered {
                        opacity: 0;
                        pointer-events: none;
                        transition: opacity 0.5s;
                    }
                </style>
            </div>
        `, 'text/html').getElementsByTagName('div')[0];
        
        td.appendChild(div);
    };

    const applyCoverage = async () => {
      
        if (!dom) {
            return;
        }
        
        const path = getPath();
        document.querySelectorAll('.tree-item-file-name').forEach(td => {
            const name = td.innerText.trim();
            if (!name || name === '..') {
               return;
            }
            const file = path+name;
            applyCoverageOnPath(file, td);
        });
        
        const title = document.querySelector('.file-title-name');
        if (title) {
            node = dom.querySelectorAll('[filename="'+path+title.innerText+'"]')[0];
            node.querySelectorAll('line').forEach(line => {
                const number = line.getAttribute('number');
                const hits = line.getAttribute('hits');
                
                const target = document.querySelector(`[data-line-number="${number}"]`).parentElement;
                
                
                const parser = new DOMParser();
                const div = parser.parseFromString(`
                    <div
                        class="coverage-hover"
                        style="
                            background: ${hits === '0' ? '#dc3545' : '#28a745'};
                            height: 100%;
                            width: 4px;
                            position: absolute;
                            left: 0;
                            top: 0;
                            z-index: 10;
                        "
                        hits="${hits}"
                    >
                        <div class="coverage-hovered" style="position: absolute;bottom: 20px;left: 0px;border: 1px solid #000;z-index: 10;box-shadow: 1px 1px 8px #000;">
                            <div style="white-space: nowrap;padding: 2px 10px; background: ${hits === '0' ? '#dc3545' : '#28a745'}; color: #000;">${hits} hits</div>
                        </div>
                        <style>
                            .coverage-hover:hover .coverage-hovered {
                                opacity: 1;
                            }
                            .coverage-hovered {
                                opacity: 0;
                                pointer-events: none;
                                transition: opacity 0.5s;
                            }
                        </style>
                    </div>
                `, 'text/html').getElementsByTagName('div')[0];
                target.appendChild(div);
                
            });
        }
    };

    dom = await getDomCoverage();
    await applyCoverage();
    
    let lastURL = document.location.href.toString();
    setInterval(() => {
      if (lastURL !== document.location.href.toString()){
          lastURL = document.location.href.toString();
          applyCoverage();
      }
    }, 400);
})();