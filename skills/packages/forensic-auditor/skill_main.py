import os, sys, json
if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    py_files = [os.path.join(dp, f) for dp, _, fn in os.walk(root) for f in fn if f.endswith('.py')]
    print(json.dumps({'ok': True, 'skill': 'forensic-auditor', 'scanned_py_files': len(py_files)}))
