const path = require('path');
const fs = require('fs');
const parser = require('@babel/parser');
const t = require('@babel/types');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const ejs = require('ejs');

class Compiler {
    constructor (config) {
    	this.config = config
        this.modules = {}
        this.entryPath = ''
        this.root = process.cwd()
    }
    getSource (modulePath) { 
    	const content = fs.readFileSync(modulePath, 'utf-8')
        return content
    }
    parse (source, dirname) { // 生成AST
        let ast = parser.parse(source)
        // 模块依赖项列表
        let dependencies = []
        // 遍历AST结点
        traverse(ast, {
            CallExpression (p) {
                const node = p.node
                if (node.callee.name === 'require') {
                    // 函数名替换
                    node.callee.name = '__webpack_require__'
                    // 路径替换
                    let modulePath = node.arguments[0].value
                    if (!path.extname(modulePath)) {
                        throw new Error(`没有找到文件 : ${modulePath} , 检查是否加上正确的文件后缀`)
                    }
                    modulePath = './' + path.join(dirname, modulePath).replace(/\\/g, '/')
                    node.arguments = [t.stringLiteral(modulePath)]
                    // 保存模块依赖项
                    dependencies.push(modulePath)
                }
            }
        })
        // 生成新的代码
        let sourceCode = generator(ast).code
        return { 
            sourceCode, dependencies
        }
    }
    emit () {
        const { modules, entryPath } = this
        const outputPath = path.resolve(this.root, this.config.output.path)
        const filePath = path.resolve(outputPath, this.config.output.filename)
        if (!fs.readdirSync(outputPath)) {
            fs.mkdirSync(outputPath);
        }
        ejs.renderFile(path.join(__dirname, 'template.ejs'), { modules, entryPath })
            .then(code => {
                fs.writeFileSync(filePath, code)
            })
    }
    buildModule (modulePath, isEntry) {
        let source = this.getSource(modulePath)
        let moduleName = './' + path.relative(this.root, modulePath).replace(/\\/g, '/')

        if (isEntry) this.entryPath = moduleName

        let { sourceCode, dependencies } = this.parse(source, path.dirname(moduleName))

        this.modules[moduleName] = JSON.stringify(sourceCode)

        dependencies.forEach(d => this.buildModule(path.join(this.root, d)), false)
    }
    run () {
        const { entry } = this.config
        this.buildModule(path.resolve(this.root, entry), true)
        this.emit()
    }
}

module.exports = Compiler