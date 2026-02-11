import cognee
import pkgutil

def list_modules(package):
    for loader, module_name, is_pkg in pkgutil.walk_packages(package.__path__, package.__name__ + "."):
        print(module_name)

# list_modules(cognee)

print("Main attributes:", dir(cognee))
if hasattr(cognee, 'api'):
    print("API attributes:", dir(cognee.api))
    if hasattr(cognee.api, 'v1'):
        print("V1 attributes:", dir(cognee.api.v1))
