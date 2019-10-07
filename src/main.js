const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const marked = require('marked');

export const convertRelativePathToAbsolutePath = (thePath) => {
  if (path.isAbsolute(thePath) === false) {
    return path.resolve(thePath);
  }
  return thePath;
};
export const isFile = thePath => fs.statSync(thePath).isFile();

export const isMd = file => (path.extname(file) === '.md');

export const walkDirectory = (thePath) => {
  const absolutePath = convertRelativePathToAbsolutePath(thePath);
  let arrFileMd = [];
  if (isFile(absolutePath)) {
    if (isMd(absolutePath)) {
      arrFileMd.push(absolutePath);
    }
  } else {
    const pathOfFiles = fs.readdirSync(absolutePath);
    pathOfFiles.forEach((file) => {
      arrFileMd = arrFileMd.concat(walkDirectory(path.join(absolutePath, file)));
    });
  }
  return arrFileMd;
};

export const saveLinks = (filePath) => {
  const arrayOfRoutes = walkDirectory(filePath);
  const allLinks = [];
  arrayOfRoutes.forEach((thePath) => {
    const readFiles = fs.readFileSync(thePath, 'utf8');
    const renderer = new marked.Renderer();
    renderer.link = (href, title, text) => {
      allLinks.push({
        href,
        text,
        thePath,
      });
    };
    marked(readFiles, { renderer });
  });
  return allLinks;
};

export const validate = (arrObj) => {
  const fetchLink = arrObj.map(file => fetch(file.href)
    .then((res) => {
      if (res.status >= 200 && res.status <= 208) {
        return {
          ...file,
          status: res.status,
          statusText: res.statusText,
        };
      } return {
        ...file,
        status: res.status,
        statusText: 'FAIL',
      };
    })
    .catch(() => ({
      ...file,
      status: 'ERROR',
      statusText: 'FAIL',
    })));
  return Promise.all(fetchLink);
};

export const stats = arrObj => `Total: ${arrObj.length} \nUnique: ${new Set(arrObj.map(item => item.href)).size}`;

export const statsValidate = (arrObj) => {
  const objStats = stats(arrObj);
  return `${objStats} \nBroken: ${arrObj.map(item => item.statusText).filter(word => word === 'FAIL').length}`;
};

export const mdLinks = (thePath, options) => new Promise((resolve) => {
  const absolutePath = convertRelativePathToAbsolutePath(thePath);
  if (options === undefined || options.validate === false) {
    resolve(saveLinks(absolutePath));
  } else {
    const arrayOfLinks = saveLinks(absolutePath);
    resolve(validate(arrayOfLinks));
  }
});

export const bool = (opt1, opt2) => {
  if ((opt1 === '--validate' && opt2 === undefined) || (opt1 === '--stats' && opt2 === '--validate')) return { validate: true };
  return { validate: false };
};

export const mdLinksCli = (thePath, opt1, opt2) => {
  const options = bool(opt1, opt2);
  return mdLinks(thePath, options)
    .then((res) => {
      let response = '';
      if (res.length === 0) {
        response += '> No se encontraron links o archivos md en la ruta dada.';
      }
      if (opt1 === undefined) {
        res.forEach((file) => {
          response += `\n${file.thePath} ${file.href} ${file.text.substr(0, 50)}`;
        });
      }
      if (opt1 === '--stats' && opt2 === undefined) {
        response += stats(res);
      }
      if (opt1 === '--validate' && opt2 === undefined) {
        res.forEach((file) => {
          response += `\n${file.thePath} ${file.href} ${file.statusText} ${file.status} ${file.text.substr(0, 50)}`;
        });
      }
      if (opt1 === '--stats' && opt2 === '--validate') {
        response += statsValidate(res);
      }
      if ((opt1 !== '--stats' && opt1 !== '--validate' && opt1 !== undefined) || (opt2 !== '--validate' && opt2 !== undefined)) {
        response += '> No es un comando válido!!!';
      }
      return response;
    });
};
