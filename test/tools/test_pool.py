class TestPool:
    tests = []

    def get_tests(self, config):
        return [test(config) for test in self.tests]


    def register_test(self, test):
        self.tests.append(test)


test_pool = TestPool()