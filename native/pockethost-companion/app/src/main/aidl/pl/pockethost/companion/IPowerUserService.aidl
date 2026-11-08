package pl.pockethost.companion;

interface IPowerUserService {
    void destroy() = 16777114;
    String readCpuAndProcesses() = 2;
    String readInstalledPackages() = 3;
    String readSystemOverview() = 4;
    String inspectApp(String packageName) = 5;
    String runOwnerAction(String action, String target, String value) = 6;
}
