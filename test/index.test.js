const fs = require('fs');
const path = require('path');
const parse = require('remark-parse');
const stringify = require('remark-stringify');
const vfile = require('vfile');
const toVFile = require('to-vfile');
const unified = require('unified');
const mermaid = require('../src/');

const fixturesDir = path.join(__dirname, '/fixtures');
const runtimeDir = path.join(__dirname, '/runtime');
const remark = unified().use(parse).use(stringify).freeze();

// Utility function to add metdata to a vFile.
function addMetadata(vFile, destinationFilePath) {
  vFile.data = {
    destinationFilePath,
    destinationDir: path.dirname(destinationFilePath),
  };
}

describe('remark-mermaid', () => {
  it('it ignores markdown that does not have mermaid references', () => {
    const srcFile = `${fixturesDir}/simple.md`;
    const destFile = `${runtimeDir}/simple.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).not.toMatch(/!\[\]\(\w+\.svg/);
    expect(vfile.messages).toHaveLength(0);
  });

  it('can handle code blocks', () => {
    const srcFile = `${fixturesDir}/code-block.md`;
    const destFile = `${runtimeDir}/code-block.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/!\[\]\(\w+\.svg/);
    expect(vfile.messages[0].message).toBe('mermaid code block replaced with graph');
  });

  it('can handle code blocks, putting the block into a comment', () => {
    const srcFile = `${fixturesDir}/code-block-comment.md`;
    const destFile = `${runtimeDir}/code-block-comment.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/!\[\]\(\w+\.svg/);
    expect(result).toMatch(/graph LR/);
    expect(result).toMatch(/\n```/m);
    expect(result).toMatch(/<summary>Mermaid source<\/summary>/);
    expectFixedPoint(srcFile);
  });

  it('updates the outdated images', () => {
    const srcFile = `${fixturesDir}/outdated-comment.md`;
    const destFile = `${runtimeDir}/outdated-comment.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).not.toMatch(/db3c1050564eea0d99f028979a7a2218aa4fa581\.svg/);
    expect(result.match(/<summary>/g)).toHaveLength(1);
    expectFixedPoint(srcFile);
  });


  function expectFixedPoint(srcFile) {
    const destFile = `${runtimeDir}/first-output.md`;
    const destFile2 = `${runtimeDir}/second-pass.md`;
    const vfileOne = toVFile.readSync(srcFile);
    addMetadata(vfileOne, destFile);

    const result = remark().use(mermaid).processSync(vfileOne).toString();

    const vfileAgain = vfile(result);
    addMetadata(vfileAgain, destFile2);

    const resultAgain = remark().use(mermaid).processSync(vfileAgain).toString();

    expect(result).toEqual(resultAgain);
  }

  it('can handle mermaid images', () => {
    const srcFile = `${fixturesDir}/image-mermaid.md`;
    const destFile = `${runtimeDir}/image-mermaid.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/!\[Example\]\(\w+\.svg/);
    expect(vfile.messages[0].message).toBe('mermaid link replaced with link to graph');
  });

  it('can handle mermaid links', () => {
    const srcFile = `${fixturesDir}/link-mermaid.md`;
    const destFile = `${runtimeDir}/link-mermaid.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/\[Example\]\(\w+\.svg/);
    expect(vfile.messages[0].message).toBe('mermaid link replaced with link to graph');
  });

  describe('simple mode', () => {
    it('can handle code blocks in simple mode', () => {
      const srcFile = `${fixturesDir}/code-block.md`;
      const destFile = `${runtimeDir}/code-block.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { simple: true }).processSync(vfile).toString();
      expect(result).toMatch(/class=\"mermaid\"/);
      expect(vfile.messages[0].message).toBe('mermaid code block replaced with div');
    });

    it('can handle mermaid images in simple mode', () => {
      const srcFile = `${fixturesDir}/image-mermaid.md`;
      const destFile = `${runtimeDir}/image-mermaid.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { simple: true }).processSync(vfile).toString();
      expect(result).toMatch(/class=\"mermaid\"/);
      expect(vfile.messages[0].message).toBe('mermaid link replaced with div');
    });

    it('can handle mermaid links in simple mode', () => {
      const srcFile = `${fixturesDir}/link-mermaid.md`;
      const destFile = `${runtimeDir}/link-mermaid.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { simple: true }).processSync(vfile).toString();
      expect(result).toMatch(/class=\"mermaid\"/);
      expect(vfile.messages[0].message).toBe('mermaid link replaced with div');
    });
  });

  describe('imageDir', () => {
    it('can handle code blocks while setting image dir', () => {
      const srcFile = `${fixturesDir}/code-block.md`;
      const destFile = `${runtimeDir}/code-block.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { imageDir: 'images' }).processSync(vfile).toString();
      expect(result).toMatch(/!\[\]\(images\/\w+\.svg/);
      expect(vfile.messages[0].message).toBe('mermaid code block replaced with graph');
    });
  });

  it('works with two code blocks immediately in a row', () => {
    const srcFile = `${fixturesDir}/two-code-blocks-in-a-row.md`;
    const destFile = `${runtimeDir}/two-code-blocks-in-a-row.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result.match(/<summary>/g)).toHaveLength(2);
    expect(result.match(/<\/summary>/g)).toHaveLength(2);
    expect(result.match(/!\[\]\(\w+\.svg/g)).toHaveLength(2);

    expectFixedPoint(srcFile);
  });

  it('works with two code blocks immediately in a row', () => {
    const srcFile = `${fixturesDir}/two-new-code-blocks-in-a-row.md`;
    const destFile = `${runtimeDir}/two-new-code-blocks-in-a-row.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result.match(/<summary>/g)).toHaveLength(2);
    expect(result.match(/<\/summary>/g)).toHaveLength(2);
    expect(result.match(/!\[\]\(\w+\.svg/g)).toHaveLength(2);

    expectFixedPoint(srcFile);
  });

  it('reports error on invalid mermaid', () => {
    const srcFile = `${fixturesDir}/invalid-mermaid.md`;
    const destFile = `${runtimeDir}/invalid-mermaid.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);
    const result = remark().use(mermaid).processSync(vfile).toString();

    expect(vfile.messages[0].message).toMatch(/Parse error on line 2:/);
    const runtimeFiles = fs.readdirSync(runtimeDir);
    const mmdFiles = runtimeFiles.filter(f => /\.mmd/.test(f));
    expect(mmdFiles).toHaveLength(0);
  });
});
