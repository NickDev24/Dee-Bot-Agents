import os, json
if __name__ == '__main__':
    load1, load5, load15 = os.getloadavg()
    print(json.dumps({'ok': True, 'skill': 'cluster-diagnostics', 'loadavg': [load1, load5, load15]}))
