import ast, sys, json
if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else __file__
    src = open(target, encoding='utf-8').read()
    tree = ast.parse(src)
    print(json.dumps({'ok': True, 'skill': 'code-verifier', 'ast_nodes': len(list(ast.walk(tree)))}))
